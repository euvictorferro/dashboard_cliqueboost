// src/app/api/webhooks/stripe/route.ts
// Rota pública: autenticada pela assinatura Stripe (STRIPE_WEBHOOK_SECRET), não por verifyClientToken.
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { fetchClientIdByStripeCustomerId, fetchClientSettings } from "@/lib/clientSettings";
import { createClientPayment, hasClientPayments } from "@/lib/clientPayments";
import { findPendingConversion, markDiscountApplied } from "@/lib/referralLeads";

const REFERRAL_DISCOUNT_PERCENT_OFF = 20;

async function applyReferralDiscount(convertedClientId: string, stripe: Stripe) {
  const pending = await findPendingConversion(convertedClientId);
  if (!pending) return;

  const referrerSettings = await fetchClientSettings(pending.referrerClientId);
  if (!referrerSettings.stripeSubscriptionId) {
    console.error(`[webhooks/stripe] indicação ${pending.id}: referrer ${pending.referrerClientId} sem stripe_subscription_id`);
    return;
  }

  const coupon = await stripe.coupons.create({ percent_off: REFERRAL_DISCOUNT_PERCENT_OFF, duration: "once" });
  await stripe.subscriptions.update(referrerSettings.stripeSubscriptionId, {
    discounts: [{ coupon: coupon.id }],
  });
  await markDiscountApplied(pending.id);
}

async function handleInvoicePaid(invoice: Stripe.Invoice, stripe: Stripe) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const clientId = await fetchClientIdByStripeCustomerId(customerId);
  if (!clientId) {
    console.error(`[webhooks/stripe] nenhum client_settings com stripe_customer_id=${customerId}`);
    return;
  }

  const isFirstPayment = !(await hasClientPayments(clientId));
  const paidAt = new Date((invoice.status_transitions?.paid_at ?? invoice.created) * 1000).toISOString().slice(0, 10);
  await createClientPayment(clientId, paidAt, invoice.amount_paid ? invoice.amount_paid / 100 : null);

  if (isFirstPayment) {
    await applyReferralDiscount(clientId, stripe);
  }
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    console.error("[webhooks/stripe] STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET ausente");
    return Response.json({ error: "not_configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  if (!signature) {
    return Response.json({ error: "missing_signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[webhooks/stripe] assinatura inválida:", err);
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    if (event.type === "invoice.paid") {
      await handleInvoicePaid(event.data.object as Stripe.Invoice, stripe);
    }
  } catch (err) {
    console.error(`[webhooks/stripe] falha ao processar evento ${event.id} (${event.type}):`, err);
  }

  return Response.json({ received: true });
}
