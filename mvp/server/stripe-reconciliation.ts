import Stripe from 'stripe';

/**
 * Storage-neutral reconciliation boundary. Implement ReconciliationStore using
 * transactional managed database writes before enabling live webhooks.
 * This module deliberately does not acknowledge events without durable storage.
 */
export type PaymentState = 'pending' | 'succeeded' | 'failed' | 'refunded';
export interface ReconciliationStore {
  applyEventOnce(input: {
    eventId: string;
    eventType: string;
    livemode: boolean;
    stripeObjectId: string;
    paymentIntentId?: string;
    customerId?: string;
    invoiceId?: string;
    amountCents?: number;
    currency?: string;
    state?: PaymentState;
    receivedAt: string;
  }): Promise<'inserted' | 'duplicate'>;
}

function reference(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id;
  return undefined;
}

export function normalizeStripeEvent(event: Stripe.Event) {
  const obj = event.data.object as unknown as Record<string, unknown>;
  const type = event.type;
  let state: PaymentState | undefined;
  if (type === 'checkout.session.completed') {
    // Async payment methods can complete checkout before payment settles.
    state = obj.payment_status === 'paid' ? 'succeeded' : 'pending';
  } else if (type === 'checkout.session.async_payment_succeeded' || type === 'invoice.paid' || type === 'payment_intent.succeeded') state = 'succeeded';
  else if (type === 'checkout.session.async_payment_failed' || type === 'invoice.payment_failed' || type === 'payment_intent.payment_failed') state = 'failed';
  else if (type === 'charge.refunded') state = 'refunded';
  const amount = obj.amount_total ?? obj.amount_paid ?? obj.amount_received ?? obj.amount;
  return {
    eventId: event.id,
    eventType: type,
    livemode: event.livemode,
    stripeObjectId: String(obj.id || ''),
    paymentIntentId: reference(obj.payment_intent) || (type.startsWith('payment_intent.') ? reference(obj.id) : undefined),
    customerId: reference(obj.customer),
    invoiceId: reference(obj.invoice) || (type.startsWith('invoice.') ? reference(obj.id) : undefined),
    amountCents: typeof amount === 'number' && Number.isInteger(amount) ? amount : undefined,
    currency: typeof obj.currency === 'string' ? obj.currency.toLowerCase() : undefined,
    state,
    receivedAt: new Date().toISOString(),
  };
}

export async function reconcileVerifiedStripeWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  webhookSecret: string,
  stripe: Stripe,
  store: ReconciliationStore,
): Promise<'inserted' | 'duplicate'> {
  if (process.env.XPAY_STRIPE_MODE !== 'test') throw new Error('Stripe webhook staging requires test mode');
  if (!signature || !webhookSecret) throw new Error('Missing Stripe webhook signature or secret');
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  if (event.livemode) throw new Error('Live Stripe events are disabled in staging');
  return store.applyEventOnce(normalizeStripeEvent(event));
}

