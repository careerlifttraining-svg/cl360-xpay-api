# CL360 xPay — staging deployment runbook

**Do not apply to production or the existing live Stripe account.** This runbook is a staging plan; no infrastructure has been provisioned by this document.

1. Provision an isolated managed PostgreSQL staging instance with restricted network access, TLS, backups, and a dedicated least-privilege application user.
2. Apply `mvp/db/001_stripe_reconciliation.sql` using a migration operator after reviewing the target database and credentials. Verify both tables and indexes exist.
3. Supply `XPAY_DATABASE_URL` only via the staging secret manager. For remote hosts include `sslmode=verify-full` with trusted CA verification where supported; at minimum `sslmode=require` is enforced by the application.
4. Use only Stripe test-mode credentials. Configure `XPAY_STRIPE_MODE=test`, `STRIPE_SECRET_KEY` with a test key, and the staging endpoint signing secret; keep `XPAY_STAGING_WEBHOOK_ENABLED=false` until smoke tests are ready.
5. Confirm the webhook rejects invalid signatures and live-mode events, and accepts valid signed test events only after database commit.
6. Replay an identical event ID twice: confirm one event row and duplicate acknowledgement. Simulate database unavailability: confirm non-2xx response and Stripe retry.
7. Verify Stripe event order, async payment completion, partial refunds, disputes, and authoritative object reconciliation **before** deriving financial totals.
8. Verify staff access controls, secrets rotation, audit trail, backup restoration, and rollback procedure.
9. Record test evidence and security approval in `mvp/STAGING_ACCEPTANCE.md` before proposing merge or production deployment.

## Current state
Unit tests and build checks have passed; real staging database and Stripe integration tests have **not** been performed. The event ledger alone is not a reliable financial dashboard or complete reconciliation engine.
