# NICJE Data Refinery

Taking messy data, making it agent-kind.

Connected to **https://x402-micro-pay.com** (native skill + partner listing). Shop homepage is not replaced.

| Surface | URL |
|---------|-----|
| Native skill | `POST https://x402-micro-pay.com/api/skills/nicje` |
| On-domain UI | https://x402-micro-pay.com/nicje |
| Dedicated host | https://nicje-x402.vercel.app |
| Recipe jobs | `POST /api/recipes/{eval_set,rag_chunks,policy_digest,custom}/run` |
| Catalog | `GET /api/catalog` |

Paid recipe calls use x402 v2: unpaid calls get HTTP 402 with `PAYMENT-REQUIRED` (scheme `exact`, USDC `0x8335…2913` on Base `eip155:8453`, payTo `TREASURY_ADDRESS`). Payments are verified and settled through the CDP facilitator (`CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`); a job that fails is never settled. No test/bypass headers. `npm test` runs the paywall tests. Target subdomain: `nicje.x402-micro-pay.com` (CNAME still needs Vercel attach).
