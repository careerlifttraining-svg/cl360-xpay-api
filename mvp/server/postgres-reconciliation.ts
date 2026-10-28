import pg from 'pg';
import type { ReconciliationStore } from './stripe-reconciliation.js';

type StripeRecord = Parameters<ReconciliationStore['applyEventOnce']>[0];

/** Postgres event ledger. The payment projection is deliberately not populated
 * until authoritative Stripe object retrieval and ordering are implemented. */
export class PostgresReconciliationStore implements ReconciliationStore {
  constructor(private readonly pool: pg.Pool) {}

  async applyEventOnce(event: StripeRecord): Promise<'inserted' | 'duplicate'> {
    if (!event.eventId || !event.stripeObjectId) throw new Error('Missing Stripe event identifiers');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO xpay_stripe_events
         (event_id,event_type,livemode,stripe_object_id,payment_intent_id,
          stripe_customer_id,stripe_invoice_id,amount_cents,currency,payment_state,received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
        [event.eventId,event.eventType,event.livemode,event.stripeObjectId,
         event.paymentIntentId??null,event.customerId??null,event.invoiceId??null,
         event.amountCents??null,event.currency??null,event.state??null,event.receivedAt],
      );
      await client.query('COMMIT');
      return result.rowCount === 1 ? 'inserted' : 'duplicate';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export function createStagingReconciliationStore(): {pool: pg.Pool;store: PostgresReconciliationStore} {
  if (process.env.XPAY_STRIPE_MODE !== 'test') throw new Error('Staging reconciliation requires Stripe test mode');
  const connectionString = process.env.XPAY_DATABASE_URL;
  if (!connectionString) throw new Error('XPAY_DATABASE_URL is required');
  const parsed = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('XPAY_DATABASE_URL must use PostgreSQL');
  const local = ['localhost','127.0.0.1','::1'].includes(parsed.hostname);
  if (!local && !['require','verify-ca','verify-full'].includes(parsed.searchParams.get('sslmode') || '')) throw new Error('Remote staging PostgreSQL requires explicit TLS sslmode');
  const pool = new pg.Pool({connectionString, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000});
  return {pool,store:new PostgresReconciliationStore(pool)};
}
