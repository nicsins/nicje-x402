// x402 v2 paywall: verify + settle through the CDP facilitator (mirrors ai-micro-pay).
// Fail closed: no valid, facilitator-verified, settled payment => no paid content.
const crypto = require("crypto");
const {
  x402ResourceServer,
  HTTPFacilitatorClient,
} = require("@x402/core/server");
const {
  encodePaymentRequiredHeader,
  decodePaymentSignatureHeader,
  encodePaymentResponseHeader,
} = require("@x402/core/http");
const { ExactEvmScheme } = require("@x402/evm/exact/server");
const { TREASURY_ADDRESS } = require("./_treasury");

const NETWORK = "eip155:8453"; // Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MAX_TIMEOUT_SECONDS = 300;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "https://nicje-x402.vercel.app").replace(/\/+$/, "");

// CDP secrets are sometimes stored as SEC1 PEM with literal "\n" and stray
// backslashes; the CDP SDK needs PKCS#8. Normalize without ever logging it.
function normalizeCdpSecret(raw) {
  if (!raw) return raw;
  let s = String(raw).trim().replace(/^["']|["']$/g, "");
  if (!s.includes("-----BEGIN")) return s; // Ed25519 base64 key: pass through
  s = s
    .replace(/\\+n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\\+$/, "").trim())
    .filter(Boolean)
    .join("\n");
  return crypto.createPrivateKey(s + "\n").export({ type: "pkcs8", format: "pem" });
}

function defaultFacilitator() {
  const id = process.env.CDP_API_KEY_ID;
  const secret = process.env.CDP_API_KEY_SECRET;
  if (!id || !secret) throw new Error("CDP_API_KEY_ID/CDP_API_KEY_SECRET not set");
  const { createFacilitatorConfig } = require("@coinbase/x402");
  return new HTTPFacilitatorClient(createFacilitatorConfig(id.trim(), normalizeCdpSecret(secret)));
}

let serverPromise = null;
function getServer(factory = defaultFacilitator) {
  if (!serverPromise) {
    serverPromise = (async () => {
      const server = new x402ResourceServer(factory());
      server.register(NETWORK, new ExactEvmScheme());
      await server.initialize();
      return server;
    })().catch((e) => {
      serverPromise = null; // retry on next request
      throw e;
    });
  }
  return serverPromise;
}

function _resetForTests() {
  serverPromise = null;
}

function readPaymentHeader(req) {
  const h = req.headers || {};
  return h["payment-signature"] || h["x-payment"] || null;
}

async function buildRequired(server, { usd, path, description }, error) {
  const requirements = await server.buildPaymentRequirementsFromOptions(
    [
      {
        scheme: "exact",
        network: NETWORK,
        payTo: TREASURY_ADDRESS,
        price: `$${usd}`,
        maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
      },
    ],
    {},
  );
  for (const r of requirements) {
    if (r.asset.toLowerCase() !== USDC_BASE.toLowerCase()) throw new Error("unexpected asset");
  }
  const paymentRequired = await server.createPaymentRequiredResponse(
    requirements,
    { url: `${PUBLIC_BASE_URL}${path}`, description, mimeType: "application/json" },
    error,
  );
  return { requirements, paymentRequired };
}

function send402(res, paymentRequired) {
  res.setHeader("PAYMENT-REQUIRED", encodePaymentRequiredHeader(paymentRequired));
  res.setHeader("Cache-Control", "no-store");
  return res.status(402).json(paymentRequired);
}

/**
 * Gate a paid handler. `handler()` returns {status, body}; settlement only happens
 * when status is 200, so a failed job is never charged.
 */
async function withPayment(req, res, opts, handler, { serverFactory } = {}) {
  let server;
  try {
    server = await getServer(serverFactory);
  } catch (e) {
    console.error("x402 facilitator init failed:", e && e.message);
    return res.status(503).json({ error: "payments temporarily unavailable" });
  }
  let built;
  try {
    built = await buildRequired(server, opts);
  } catch (e) {
    console.error("x402 build requirements failed:", e && e.message);
    return res.status(503).json({ error: "payments temporarily unavailable" });
  }
  const header = readPaymentHeader(req);
  if (!header) return send402(res, built.paymentRequired);

  let payload;
  try {
    payload = decodePaymentSignatureHeader(String(header));
  } catch {
    return send402(res, (await buildRequired(server, opts, "invalid payment header")).paymentRequired);
  }
  const requirement = payload && server.findMatchingRequirements(built.requirements, payload);
  if (!requirement) {
    return send402(res, (await buildRequired(server, opts, "payment does not match requirements")).paymentRequired);
  }
  let verify;
  try {
    verify = await server.verifyPayment(payload, requirement);
  } catch (e) {
    console.error("x402 verify error:", e && e.message);
    return send402(res, (await buildRequired(server, opts, "payment verification failed")).paymentRequired);
  }
  if (!verify || !verify.isValid) {
    const reason = (verify && (verify.invalidReason || verify.invalidMessage)) || "invalid payment";
    return send402(res, (await buildRequired(server, opts, String(reason))).paymentRequired);
  }

  const result = await handler();
  if (!result || result.status !== 200) {
    return res.status((result && result.status) || 500).json((result && result.body) || { error: "failed" });
  }

  let settle;
  try {
    settle = await server.settlePayment(payload, requirement);
  } catch (e) {
    console.error("x402 settle error:", e && e.message);
    settle = null;
  }
  if (!settle || !settle.success) {
    const reason = (settle && (settle.errorReason || settle.errorMessage)) || "settlement failed";
    return send402(res, (await buildRequired(server, opts, String(reason))).paymentRequired);
  }
  res.setHeader("PAYMENT-RESPONSE", encodePaymentResponseHeader(settle));
  res.setHeader("Access-Control-Expose-Headers", "PAYMENT-RESPONSE, PAYMENT-REQUIRED");
  return res.status(200).json(result.body);
}

module.exports = {
  NETWORK,
  USDC_BASE,
  MAX_TIMEOUT_SECONDS,
  PUBLIC_BASE_URL,
  normalizeCdpSecret,
  getServer,
  withPayment,
  _resetForTests,
};
