# Staff API authentication — deployment contract

Staff API routes are closed by default in production.

## Server-side integration
- Set `XPAY_STAFF_AUTH_ENABLED=true` **only** after an authenticated backend token issuer and authorization tests are deployed.
- Configure `XPAY_STAFF_TOKEN_SECRET` as a high-entropy secret of at least 32 bytes through the Render secret manager; never commit it or embed it in the browser.
- The API expects an HS256 bearer JWT with `iss=cl360-xpay`, `aud=cl360-xpay-staff`, `workspaceId=careerLift360`, a nonempty `sub`, and a permitted `role` (`admin`, `finance`, `support`, `viewer`).
- Tokens must expire within one hour, and the API checks signature, expiration, audience, issuer, role, and workspace.
- A production token issuer, user provisioning, revocation/rotation plan, audit actor attribution, and browser session/OIDC login are **not yet implemented**. Do not enable the flag until these are delivered.
- Production GPT financial endpoints remain blocked until equivalent identity and workspace authorization exists.

## Security notes
The HMAC verifier is an internal backend integration boundary, **not** a complete enterprise SSO implementation. A single shared signing key requires controlled issuer access and rotation. Prefer a managed OIDC provider and asymmetric JWT verification for the final interactive workforce login.

## Current release decision
Keep feature branch unmerged and production flags off.
