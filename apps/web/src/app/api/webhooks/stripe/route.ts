import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler — NO auth guard. Stripe authenticates via signature.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Resolve person_id: session metadata (primary), then DB lookup by stripe_customer_id (fallback)
        let personId = session.metadata?.person_id;
        if (!personId) {
          const { data: existing } = await serviceClient
            .from('subscriptions')
            .select('person_id')
            .eq('stripe_customer_id', customerId)
            .single();
          personId = existing?.person_id;
        }

        if (!personId || !subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const item = subscription.items.data[0];
        const priceId = item?.price.id;
        const plan = mapPriceToPlan(priceId);

        await serviceClient.from('subscriptions').upsert(
          {
            person_id: personId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan,
            status:
              subscription.status === 'active'
                ? 'active'
                : subscription.status === 'trialing'
                  ? 'trialing'
                  : 'past_due',
            current_period_start: item
              ? new Date(item.current_period_start * 1000).toISOString()
              : null,
            current_period_end: item
              ? new Date(item.current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'person_id' },
        );
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const item = subscription.items.data[0];
        const priceId = item?.price.id;
        const plan = mapPriceToPlan(priceId);

        await serviceClient
          .from('subscriptions')
          .update({
            plan,
            status: mapStripeStatus(subscription.status),
            current_period_start: item
              ? new Date(item.current_period_start * 1000).toISOString()
              : null,
            current_period_end: item
              ? new Date(item.current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        await serviceClient
          .from('subscriptions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function mapPriceToPlan(priceId: string | undefined): string {
  if (priceId === process.env.STRIPE_PRICE_CREW_PRO) return 'crew_pro';
  if (priceId === process.env.STRIPE_PRICE_CREW_UNLIMITED) return 'crew_unlimited';
  return 'free';
}

function mapStripeStatus(status: string): string {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due') return 'past_due';
  return 'cancelled';
}
