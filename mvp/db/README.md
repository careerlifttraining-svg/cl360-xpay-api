# PostgreSQL reconciliation rollout

The SQL migration in `db/001_stripe_reconciliation.sql` is a staging-first schema, not a production migration that has been applied.

## Setup and verification
1. Provision managed PostgreSQL with TLS, backups, restricted credentials, and a staging-only database.
2. Review and apply the migration using a database migration runner with a tracked migration history.
3. Configure a **staging-only** Stripe test-mode webhook signing secret and test-mode API key.
4. Implement the transactional `ReconciliationStore` interface with an insert-on-conflict event ledger. Both event insertion and payment projection must commit in the **same transaction**.
5. Reconcile authoritative Stripe PaymentIntent, Invoice and Checkout Session objects; never infer final settlement solely from checkout completion.
6. Handle out-of-order delivery and refunds/partial refunds with Stripe object retrieval and ordering, not last-delivered-event-wins.
7. Test retries, duplicates, async payment success/failure, partial/full refunds, DB outages, server restarts, and mixed test/live event rejection.
8. Only after verification enable the webhook route and any dashboard reads.

## Non-negotiable controls
- No customer-facing live webhook is enabled by this migration.
- Do not expose customer details or financial records without authenticated workspace authorization.
- Acknowledging Stripe events before durable commit risks data loss; return non-2xx for transient persistence failures.
- No sample totals are acceptable in production financial reporting.
