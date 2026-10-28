-- CL360 xPay PostgreSQL reconciliation schema
-- Apply only to a managed PostgreSQL staging database after backup review.
CREATE TABLE IF NOT EXISTS xpay_stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  livemode boolean NOT NULL,
  stripe_object_id text NOT NULL,
  payment_intent_id text,
  stripe_customer_id text,
  stripe_invoice_id text,
  amount_cents bigint,
  currency text,
  payment_state text CHECK (payment_state IN ('pending','succeeded','failed','refunded')),
  stripe_created_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xpay_events_payment_intent_idx ON xpay_stripe_events(payment_intent_id);
CREATE INDEX IF NOT EXISTS xpay_events_customer_idx ON xpay_stripe_events(stripe_customer_id);
CREATE INDEX IF NOT EXISTS xpay_events_invoice_idx ON xpay_stripe_events(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS xpay_events_received_idx ON xpay_stripe_events(received_at DESC);

-- Separate test/live environments; do not combine both into one payment identity.
CREATE TABLE IF NOT EXISTS xpay_payment_snapshots (
  stripe_payment_intent_id text NOT NULL,
  livemode boolean NOT NULL,
  stripe_customer_id text,
  stripe_invoice_id text,
  amount_cents bigint,
  currency text,
  payment_state text NOT NULL CHECK (payment_state IN ('pending','succeeded','failed','refunded')),
  last_event_id text NOT NULL REFERENCES xpay_stripe_events(event_id),
  stripe_created_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(stripe_payment_intent_id,livemode)
);
CREATE INDEX IF NOT EXISTS xpay_payment_snapshots_customer_idx ON xpay_payment_snapshots(stripe_customer_id,livemode);
