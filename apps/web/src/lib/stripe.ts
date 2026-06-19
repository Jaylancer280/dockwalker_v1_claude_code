import Stripe from 'stripe';

let _stripe: Stripe | null | undefined = undefined;

export function getStripe(): Stripe | null {
  if (_stripe !== undefined) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) {
    _stripe = null;
    return null;
  }
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    typescript: true,
  });
  return _stripe;
}
