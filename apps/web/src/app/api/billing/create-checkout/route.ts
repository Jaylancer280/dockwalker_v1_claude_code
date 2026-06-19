import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { getStripe } from '@/lib/stripe';

function getPriceId(plan: string): string | undefined {
  if (plan === 'crew_pro') return process.env.STRIPE_PRICE_CREW_PRO;
  if (plan === 'employer_pro') return process.env.STRIPE_PRICE_EMPLOYER_PRO;
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

    if (!plan || !['crew_pro', 'employer_pro'].includes(plan)) {
      return NextResponse.json({ error: 'plan must be crew_pro or employer_pro' }, { status: 400 });
    }

    const priceId = getPriceId(plan);
    if (!priceId) {
      return NextResponse.json(
        { error: `Price not configured for plan: ${plan}` },
        { status: 500 },
      );
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Look up existing customer_id from any of the user's rows. B-014: a
    // single person can hold up to 3 rows (free + crew_pro + employer_pro)
    // — all share the same stripe_customer_id, so any row is fine for the
    // lookup. `.limit(1)` makes this multi-row-safe.
    const { data: existingRows } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('person_id', user.id)
      .limit(1);
    const existingCustomerId = existingRows?.[0]?.stripe_customer_id;

    let customerId: string;

    if (existingCustomerId) {
      customerId = existingCustomerId;
    } else {
      // Create Stripe customer + insert the 'free' anchor row.
      const customer = await stripe.customers.create({
        metadata: { person_id: user.id },
      });
      customerId = customer.id;

      // B-014: upsert key is (person_id, plan) so the 'free' anchor row
      // never overwrites a pre-existing pro row (it just inserts the
      // 'free' row if missing, idempotent otherwise).
      await serviceClient.from('subscriptions').upsert(
        {
          person_id: user.id,
          stripe_customer_id: customerId,
          plan: 'free',
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'person_id,plan' },
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
