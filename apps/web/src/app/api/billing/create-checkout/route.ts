import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { getStripe } from '@/lib/stripe';

function getPriceId(plan: string): string | undefined {
  if (plan === 'crew_pro') return process.env.STRIPE_PRICE_CREW_PRO;
  if (plan === 'crew_unlimited') return process.env.STRIPE_PRICE_CREW_UNLIMITED;
  return undefined;
}

/**
 * POST /api/billing/create-checkout
 * Creates a Stripe Checkout Session for a subscription plan.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase, serviceClient } = guard.value;

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { plan } = body;

    if (!plan || !['crew_pro', 'crew_unlimited'].includes(plan)) {
      return NextResponse.json(
        { error: 'plan must be crew_pro or crew_unlimited' },
        { status: 400 },
      );
    }

    const priceId = getPriceId(plan);
    if (!priceId) {
      return NextResponse.json(
        { error: `Price not configured for plan: ${plan}` },
        { status: 500 },
      );
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Check for existing subscription row with stripe_customer_id
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('person_id', user.id)
      .single();

    let customerId: string;

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        metadata: { person_id: user.id },
      });
      customerId = customer.id;

      // Upsert subscription row with customer ID
      await serviceClient.from('subscriptions').upsert(
        {
          person_id: user.id,
          stripe_customer_id: customerId,
          plan: 'free',
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'person_id' },
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?cancelled=true`,
      metadata: { person_id: user.id },
    });

    return NextResponse.json({ url: session.url }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
