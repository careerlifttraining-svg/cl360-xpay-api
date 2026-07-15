# Security model

## Trust boundaries

The browser is untrusted. All authorization, amount validation, workspace scoping, provider calls, and audit writes belong on the API. Provider webhooks are untrusted until their signatures are verified against the raw request body. CFO events must be signed, timestamped, replay-protected, and queued.

## Roles

- **Admin:** workspace configuration, users, integrations, audit access, all finance workflows.
- **Finance:** customers, invoices, payment links, transactions, CFO events.
- **Support:** read-only customer/payment metadata with sensitive fields minimized.
- **Viewer:** aggregate dashboards and permitted reports.

Use least privilege, MFA for admin and finance roles, short session lifetimes, device/session revocation, and step-up authentication for refunds, payout changes, or integration changes.

## Required production controls

1. Verified OIDC sessions and tenant/workspace authorization on every resource.
2. Stripe webhook signature verification, event deduplication, and asynchronous processing.
3. Idempotency keys on every mutation that can create a financial side effect.
4. Secrets stored in a managed vault and rotated; never placed in frontend variables.
5. Rate limits, bot protection, strict CSP, secure cookies, CSRF defense, and request schemas.
6. Immutable audit storage with privacy-safe IP/device signals.
7. Managed Postgres encryption, point-in-time restore, field-level protection for sensitive PII, retention/deletion workflows.
8. PCI DSS scope review, privacy impact assessment, WCAG 2.2 AA audit, vendor review, incident response exercises.
