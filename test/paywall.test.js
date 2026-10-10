const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { encodePaymentSignatureHeader, decodePaymentRequiredHeader } = require("@x402/core/http");

const x = require("../api/_x402");
const run = require("../api/recipes/[name]/run.js");

const PAYTO = "0xc22f9CAEBAc37fE72D5142f35f21f6696Ea9Ef69";

function mockFacilitator(calls, { valid = true, settleOk = true } = {}) {
  return () => ({
    getSupported: async () => ({
      kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
      extensions: [],
      signers: {},
    }),
    verify: async (payload, req) => {
      calls.push(["verify", req.amount]);
      return valid ? { isValid: true, payer: "0x1111111111111111111111111111111111111111" } : { isValid: false, invalidReason: "invalid_exact_evm_payload_signature" };
    },
    settle: async (payload, req) => {
      calls.push(["settle", req.amount]);
      return settleOk
        ? { success: true, transaction: "0xabc", network: "eip155:8453", payer: "0x1111111111111111111111111111111111111111" }
        : { success: false, errorReason: "unexpected_settle_error", transaction: "", network: "eip155:8453" };
    },
  });
}

function mkRes() {
  const r = { headers: {}, code: 0, body: undefined };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
}

async function call({ headers = {}, body = { raw: "id,v\n1,2\n2,3" }, name = "eval_set", factory }) {
  x._resetForTests();
  await x.getServer(factory);
  const res = mkRes();
  await run({ method: "POST", query: { name }, headers: { host: "evil.example", ...headers }, body }, res);
  return res;
}

function paymentFor(accepted) {
  return encodePaymentSignatureHeader({
    x402Version: 2,
    accepted,
    payload: { signature: "0x" + "11".repeat(65), authorization: { from: "0x1111111111111111111111111111111111111111", to: PAYTO, value: accepted.amount, validAfter: "0", validBefore: "9999999999", nonce: "0x" + "22".repeat(32) } },
  });
}

test("unpaid call gets a spec-correct v2 402", async () => {
  const calls = [];
  const res = await call({ factory: mockFacilitator(calls) });
  assert.equal(res.code, 402);
  const pr = res.body;
  assert.equal(pr.x402Version, 2);
  assert.equal(pr.resource.url, "https://nicje-x402.vercel.app/api/recipes/eval_set/run");
  const a = pr.accepts[0];
  assert.equal(a.scheme, "exact");
  assert.equal(a.network, "eip155:8453");
  assert.equal(a.asset, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  assert.equal(a.amount, "20000");
  assert.equal(a.payTo, PAYTO);
  assert.equal(a.maxTimeoutSeconds, 300);
  assert.ok(!("maxAmountRequired" in a));
  assert.deepEqual(decodePaymentRequiredHeader(res.headers["payment-required"]), JSON.parse(JSON.stringify(pr)));
  assert.deepEqual(calls, []);
});

test("x-test-payment bypass is gone", async () => {
  const calls = [];
  const res = await call({ headers: { "x-test-payment": "true" }, factory: mockFacilitator(calls) });
  assert.equal(res.code, 402);
  assert.deepEqual(calls, []);
});

test("garbage payment headers get 402 without settling", async () => {
  for (const h of ["payment-signature", "x-payment"]) {
    const calls = [];
    const res = await call({ headers: { [h]: "a".repeat(64) }, factory: mockFacilitator(calls) });
    assert.equal(res.code, 402, h);
    assert.ok(!calls.some((c) => c[0] === "settle"));
  }
});

test("payment the facilitator rejects gets 402, no settle", async () => {
  const calls = [];
  const first = await call({ factory: mockFacilitator(calls, { valid: false }) });
  const res = await call({ headers: { "payment-signature": paymentFor(first.body.accepts[0]) }, factory: mockFacilitator(calls, { valid: false }) });
  assert.equal(res.code, 402);
  assert.deepEqual(calls, [["verify", "20000"]]);
});

test("underpayment (wrong amount) does not match requirements", async () => {
  const calls = [];
  const first = await call({ factory: mockFacilitator(calls) });
  const cheap = { ...first.body.accepts[0], amount: "1" };
  const res = await call({ headers: { "payment-signature": paymentFor(cheap) }, factory: mockFacilitator(calls) });
  assert.equal(res.code, 402);
  assert.deepEqual(calls, []);
});

test("verified + settled payment returns content and PAYMENT-RESPONSE", async () => {
  const calls = [];
  const first = await call({ factory: mockFacilitator(calls) });
  const res = await call({ headers: { "payment-signature": paymentFor(first.body.accepts[0]) }, factory: mockFacilitator(calls) });
  assert.equal(res.code, 200);
  assert.equal(res.body.skill, "nicje");
  assert.ok(res.headers["payment-response"]);
  assert.deepEqual(calls, [["verify", "20000"], ["settle", "20000"]]);
});

test("failed job is never settled", async () => {
  const calls = [];
  const first = await call({ factory: mockFacilitator(calls) });
  const res = await call({ headers: { "payment-signature": paymentFor(first.body.accepts[0]) }, body: {}, factory: mockFacilitator(calls) });
  assert.equal(res.code, 400);
  assert.deepEqual(calls, [["verify", "20000"]]);
});

test("settle failure withholds content", async () => {
  const calls = [];
  const first = await call({ factory: mockFacilitator(calls, { settleOk: false }) });
  const res = await call({ headers: { "payment-signature": paymentFor(first.body.accepts[0]) }, factory: mockFacilitator(calls, { settleOk: false }) });
  assert.equal(res.code, 402);
  assert.ok(!res.body.skill);
});

test("policy_digest is $0.03", async () => {
  const res = await call({ name: "policy_digest", factory: mockFacilitator([]) });
  assert.equal(res.body.accepts[0].amount, "30000");
});

test("facilitator outage fails closed with 503", async () => {
  x._resetForTests();
  const res = mkRes();
  const prev = process.env.CDP_API_KEY_ID;
  delete process.env.CDP_API_KEY_ID;
  await run({ method: "POST", query: { name: "eval_set" }, headers: { "x-test-payment": "true" }, body: { raw: "a" } }, res);
  if (prev) process.env.CDP_API_KEY_ID = prev;
  assert.equal(res.code, 503);
});

test("normalizeCdpSecret turns escaped SEC1 into PKCS8", () => {
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const sec1 = privateKey.export({ type: "sec1", format: "pem" });
  const mangled = '"' + sec1.trim().split("\n").join("\\\\n") + '\\\\n"';
  const out = x.normalizeCdpSecret(mangled);
  assert.match(out, /BEGIN PRIVATE KEY/);
  crypto.createPrivateKey(out);
});
