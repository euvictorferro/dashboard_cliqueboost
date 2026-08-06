// src/lib/stripe.ts
// ponytail: server-only — usa a Secret Key, nunca importar de um componente "use client".
import Stripe from "stripe";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}
