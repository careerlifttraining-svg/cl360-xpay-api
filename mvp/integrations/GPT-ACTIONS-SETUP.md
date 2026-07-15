# Connect CL360 xPay Finance Guard™

Target GPT: `https://chatgpt.com/g/g-6a18f1f31a84819189cc0336a3eae868-cl360-xpay-finance-guardtm`

The share URL identifies the GPT but does not authorize API access. Complete these steps only after deploying the xPay API behind HTTPS.

1. Generate a long random secret and store it as `GPT_ACTIONS_API_KEY` in the server secret manager.
2. Set `GPT_ACTIONS_ENABLED=true` in the deployed sandbox environment.
3. Confirm whether the API is served from `https://www.cl360ai.com` or a dedicated domain such as `https://api.cl360ai.com`; update `servers[0].url` in the OpenAPI file.
4. In ChatGPT, open the GPT editor, select **Actions**, and create a new action.
5. Import `gpt-actions.openapi.yaml`.
6. Choose **API key**, **Bearer**, and enter the same secret. Never paste an OpenAI API key, Stripe key, or database credential here.
7. Test `getFinanceSummary`, `listInvoices`, and `listCustomers` in Preview.
8. Keep the action private during sandbox testing. Review GPT instructions so it always states that results are operational summaries, not financial, legal, tax, or investment advice.

The first integration is intentionally read-only. Payment links, invoices, refunds, payout changes, or other mutations should require user identity, explicit confirmation, idempotency, and an approval workflow before they are exposed to a GPT.
