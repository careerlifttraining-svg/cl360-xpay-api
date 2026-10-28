# CL360 xPay — Production Readiness

Status: development only; not approved for live customer payments.

## Architecture
- Public site: cl360ai.com
- Existing xPay app: xpay.cl360ai.com (Render)
- Backend: cl360-xpay-api (Render)
- Payment processor: Stripe
- Internal operations dashboard: Base44 CL360 OS

## Release gates
1. Confirm the exact Render build root, start command, deployed frontend and backend code paths before editing payment logic.
2. Keep demonstration records and previously created $500 development links out of revenue reporting. Do not delete or disable real Stripe resources without explicit approval.
3. Use a durable managed database and migration/backup plan for customers, invoices, payment events and audit logs; never rely on in-memory arrays.
4. Implement authenticated, role-scoped staff APIs; do not trust client-provided role headers.
5. Stripe Checkout or hosted invoices must collect/associate customer identity and persist Stripe customer, invoice, session, payment intent and internal reference IDs.
6. Verify Stripe webhook signatures using raw request bodies; deduplicate event IDs, tolerate retries and out-of-order delivery; reconcile paid/failed/refunded statuses using authoritative Stripe objects.
7. Keep Stripe secret keys and webhook secrets in server-side environment variables only; no sensitive payment credentials in GitHub or Base44 client code.
8. Synchronize only authorized financial summaries and relevant records to Base44 through authenticated server-to-server APIs. Define ownership, permissions, mapping and failure/retry policy.
9. Run test-mode checkout, invoice, webhook retry, refund, access-control, restart and reconciliation tests in isolated staging.
10. Validate cold-start and webhook availability, backups, monitoring, error alerting and recovery before production release.
11. Review PR, deploy staging, obtain founder approval, then deploy production with rollback plan.

## Deployment safeguard
Do not merge this development branch to `main` or manually deploy to the live Render service before all gates pass.
