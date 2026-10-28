# CL360 xPay staging acceptance checklist

This checklist is a **release gate**, not evidence of completed tests.

## Build and configuration
- [x] GitHub Actions TypeScript and Vite build passed on commit `a4b5a43b814f8e2053ad5d42620e23f3165dfabc` (run 40772880254).
- [x] Render blueprint disables demo authentication, customer data, checkout, and webhook processing by default.
- [ ] Confirm actual Render service environment matches the reviewed blueprint (blueprint values alone are not proof).
- [ ] Review dependency lockfile and reproducible CI install strategy.

## Identity and authorization
- [ ] Implement OIDC/JWT authentication with trusted issuer, audience, key rotation, workspace membership, and role enforcement.
- [ ] Verify anonymous, expired, forged, wrong-audience, and wrong-workspace requests are denied.
- [ ] Audit sensitive writes with authenticated actor identity.

## Stripe and PostgreSQL
- [ ] Provision isolated managed PostgreSQL staging instance with TLS and backups.
- [ ] Apply migration and test unique event IDs under concurrent delivery.
- [ ] Configure Stripe test-only endpoint, secret, and environment flags.
- [ ] Test valid/invalid signatures, duplicate events, retries, DB outage, and server restart.
- [ ] Implement authoritative Stripe object refresh and ordered, idempotent payment projections.
- [ ] Validate partial/full refunds, disputes, async methods, invoices, and failed payments.
- [ ] Reconcile test dashboard totals against Stripe source of truth.
- [ ] Validate webhook acknowledgement only after durable commit.

## Operational readiness
- [ ] Verify payment link creation is permissioned, auditable, and disabled until authorized.
- [ ] Validate data retention, backup restore, observability, alerting, and rollback.
- [ ] Conduct staging end-to-end acceptance tests and security review.
- [ ] Obtain final production approval before merging the PR or deploying.

**Current decision:** Keep PR #1 draft/unmerged. No live Render deployment.
