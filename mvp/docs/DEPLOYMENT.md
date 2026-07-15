# Secure public sandbox deployment

## Recommendation

Use a **Render Starter Web Service** for the first public sandbox. It matches the current Node/Express architecture, deploys from Git, supports Blueprint configuration, managed secrets, HTTP health checks, custom domains, and automatic TLS. Do not use a free sleeping instance for payment-webhook testing.

This deployment is a public **sandbox**, not a production payment launch. Data is currently in memory and resets on service restart; do not enter real customer, healthcare, privileged, or card data. Add managed Postgres and real authentication before a customer pilot.

## Deploy

1. Put this project in a private GitHub repository. Confirm `.env` is not committed.
2. Sign in to Render and choose **New → Blueprint**.
3. Connect the GitHub repository and select the root `render.yaml`.
4. Name the environment `cl360-xpay-sandbox` and create the Blueprint.
5. When prompted, add only Stripe **test-mode** values for `STRIPE_SECRET_KEY` and later `STRIPE_WEBHOOK_SECRET`. Add a long random value for `GPT_ACTIONS_API_KEY`. Do not add a `sk_live_` key; the server rejects it.
6. Keep `STRIPE_CHECKOUT_ENABLED=false` and `GPT_ACTIONS_ENABLED=false` for the first deploy.
   Keep `CUSTOMER_DATA_ENABLED=false`; customer API routes return 404 while this gate is off.
7. Wait for `/api/health` to pass on the assigned `https://cl360-xpay-mvp.onrender.com`-style address.
8. In Render → Service → Settings → Custom Domains, add `api.cl360ai.com`.
9. At the DNS provider for `cl360ai.com`, create the DNS record below using the exact Render hostname shown in the dashboard.
10. Return to Render and click **Verify**. Render provisions and renews TLS automatically.

## DNS

| Type | Host/name | Target/value | TTL |
|---|---|---|---|
| CNAME | `api` | `YOUR-RENDER-SERVICE.onrender.com` | Auto or 300 seconds |

Do not include `https://` or a path in the CNAME target. Remove a conflicting `A`, `AAAA`, or existing `CNAME` record for the `api` host. The exact target cannot be known until Render creates the service; copy it from Render rather than guessing it.

## Connect Stripe test mode

1. In Stripe, switch to **Test mode / Sandbox**.
2. Copy the test secret key beginning with `sk_test_` into Render’s `STRIPE_SECRET_KEY` secret.
3. In Stripe Workbench → Webhooks, add endpoint `https://api.cl360ai.com/api/webhooks/stripe`.
4. Subscribe only to:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Reveal that endpoint’s signing secret beginning with `whsec_` and store it in Render as `STRIPE_WEBHOOK_SECRET`.
6. Redeploy and confirm `/api/health` reports test key and webhook configuration. Never publish the health response with secret values; it reports booleans only.
7. Send a Stripe test event. A valid event returns `{ "received": true }`; a missing or invalid signature returns HTTP 400.
8. Only after webhook tests pass, change `STRIPE_CHECKOUT_ENABLED=true`. This enables **test Checkout only**; live keys remain prohibited.

## Connect Finance Guard GPT

After DNS and HTTPS work, update/import `integrations/gpt-actions.openapi.yaml` in the GPT editor. Configure Bearer API-key authentication using `GPT_ACTIONS_API_KEY`, then set `GPT_ACTIONS_ENABLED=true`. The schema exposes only three GET operations. It cannot create or change customers, invoices, links, payments, refunds, payouts, or transfers.

## Required environment variable names

No secret values belong in Git.

| Variable | Secret | Initial public-sandbox setting |
|---|---:|---|
| `NODE_ENV` | No | `production` |
| `PORT` | No | Set automatically by Render |
| `APP_URL` | No | Public API origin |
| `PUBLIC_SITE_URL` | No | Main CL360 website origin |
| `XPAY_PUBLIC_URL` | No | Public xPay page URL |
| `DEMO_AUTH` | No | `true` for sandbox only |
| `CUSTOMER_DATA_ENABLED` | No | `false` |
| `SESSION_SECRET` | Yes | Render-generated |
| `DATABASE_URL` | Yes | Not used until Postgres phase |
| `STRIPE_CHECKOUT_ENABLED` | No | `false` initially |
| `STRIPE_SECRET_KEY` | Yes | Stripe test secret only |
| `STRIPE_WEBHOOK_SECRET` | Yes | Test endpoint signing secret |
| `STRIPE_WEBHOOK_TOLERANCE_SECONDS` | No | `300` |
| `PAYPAL_ENABLED` | No | `false` |
| `PAYPAL_CLIENT_ID` | Yes | Leave unset |
| `PAYPAL_CLIENT_SECRET` | Yes | Leave unset |
| `PAYPAL_ENV` | No | `sandbox` |
| `CRYPTO_PAYMENTS_ENABLED` | No | `false` |
| `STABLECOIN_NETWORK` | No | Testnet only if later approved |
| `GPT_ACTIONS_ENABLED` | No | `false` until HTTPS test passes |
| `GPT_ACTIONS_API_KEY` | Yes | Long random bearer key |
| `CFO_WEBHOOK_URL` | No | Leave unset until configured |
| `CFO_WEBHOOK_SECRET` | Yes | Leave unset until configured |

## ELI5 checklist

- [ ] Put the code in a private GitHub box.
- [ ] Ask Render to build the box using `render.yaml`.
- [ ] Give Render the Stripe **test** key—not the live key.
- [ ] Leave the payment switch OFF.
- [ ] Point the `api` name at the address Render gives you.
- [ ] Wait until the browser shows the secure padlock.
- [ ] Tell Stripe where the webhook door is.
- [ ] Put Stripe’s webhook secret in Render.
- [ ] Send fake Stripe events and make sure signed ones enter and fake ones are rejected.
- [ ] Turn on test Checkout only after those tests pass.
- [ ] Connect Finance Guard with its separate secret key.
- [ ] Confirm Finance Guard can read summaries but cannot change anything.
- [ ] Do not use real customer data or real money yet.
