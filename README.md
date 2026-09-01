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

Unpaid agent calls return HTTP 402 (USDC on Base). Target subdomain: `nicje.x402-micro-pay.com` (CNAME still needs Vercel attach).
