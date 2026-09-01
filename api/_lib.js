const PAY_TO = "0xDa1Eab46918882f8656a41cF9fCa80e2415369d1";
const NETWORK = "eip155:8453";
const MARKETPLACE = "https://x402-micro-pay.com";

const RECIPES = {
  eval_set: { need: "evaluation", price: 0.02, label: "Eval set" },
  rag_chunks: { need: "retrieval", price: 0.02, label: "RAG chunks" },
  policy_digest: { need: "policy_interpretation", price: 0.03, label: "Policy digest" },
  custom: { need: "general", price: 0.02, label: "Custom job" },
};

const BLOAT = [
  /in accordance with/gi,
  /as per (the )?policy/gi,
  /it is imperative that/gi,
  /please be advised/gi,
  /in order to ensure/gi,
  /at this point in time/gi,
  /going forward/gi,
  /synerg(?:y|istic)/gi,
  /leverage/gi,
  /circle back/gi,
  /deep dive/gi,
  /holistic approach/gi,
  /best practices?/gi,
  /value[- ]add/gi,
];

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, PAYMENT-SIGNATURE, x-payment, x-test-payment",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function hasPayment(req) {
  if (req.headers["x-test-payment"] === "true") return true;
  const sig =
    req.headers["payment-signature"] ||
    req.headers["PAYMENT-SIGNATURE"] ||
    req.headers["x-payment"];
  return Boolean(sig && String(sig).length > 20);
}

function paymentRequired(req, res, usd, description) {
  const accepts = {
    scheme: "exact",
    network: NETWORK,
    maxAmountRequired: String(Math.round(usd * 1_000_000)),
    resource: `https://${req.headers.host}${req.url}`,
    description,
    mimeType: "application/json",
    payTo: PAY_TO,
    extra: { name: "nicje-data-refinery", version: "1.0.0", marketplace: MARKETPLACE },
  };
  cors(res);
  res.setHeader("PAYMENT-REQUIRED", Buffer.from(JSON.stringify(accepts)).toString("base64"));
  res.status(402).json({
    error: "Payment Required",
    message: "This endpoint requires an x402 payment. Retry with PAYMENT-SIGNATURE.",
    accepts: [accepts],
  });
}

function stripBloat(text) {
  let s = text || "";
  for (const r of BLOAT) s = s.replace(r, " ");
  return s.replace(/\s+/g, " ").trim();
}

function ingest(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) =>
        item && typeof item === "object" ? item : { value: String(item) },
      );
    }
    if (parsed && typeof parsed === "object") return [parsed];
  } catch {
    /* not json */
  }
  if (trimmed.includes(",") && trimmed.includes("\n")) {
    const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const row = {};
      headers.forEach((h, i) => {
        const v = cells[i] || "";
        row[h] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
      });
      return row;
    });
  }
  return trimmed
    .split(/\n+/)
    .filter(Boolean)
    .map((text, i) => ({ id: i + 1, text: text.trim() }));
}

function refine(raw, request, recipeName) {
  const recipe = RECIPES[recipeName] ? recipeName : "custom";
  const meta = RECIPES[recipe];
  const cleaned = stripBloat(request || raw.slice(0, 280));
  const blob = `${request} ${raw}`.toLowerCase();
  let need = meta.need;
  if (recipe === "custom") {
    if (/(test|eval|benchmark|metric)/.test(blob)) need = "evaluation";
    else if (/(rag|retriev|search|context|chunk)/.test(blob)) need = "retrieval";
    else if (/(train|fine-?tune|dataset)/.test(blob)) need = "training";
    else if (/(policy|compliance|legal|guideline)/.test(blob)) need = "policy_interpretation";
  }
  const seen = new Set();
  let rows = ingest(raw).filter((row) => {
    const k = JSON.stringify(row);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (need === "retrieval") {
    rows = rows.map((row) => ({
      ...row,
      token_est: Object.values(row).join(" ").split(/\s+/).filter(Boolean).length,
    }));
  } else if (rows.length > 8) {
    const frac = need === "evaluation" ? 0.7 : need === "training" ? 0.8 : 1;
    const n = Math.max(6, Math.round(rows.length * frac));
    const step = Math.max(1, Math.floor(rows.length / n));
    rows = rows.filter((_, i) => i % step === 0).slice(0, n);
  }
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const packageId =
    (globalThis.crypto && crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const created = new Date().toISOString();
  const schema = {
    package_id: packageId,
    created_at: created,
    need_type: need,
    row_count: rows.length,
    columns: columns.map((name) => ({
      name,
      dtype: rows.some((r) => typeof r[name] === "number") ? "number" : "string",
    })),
    agent_kind: true,
    slogan: "Taking messy data, making it agent-kind.",
  };
  return {
    skill: "nicje",
    package_id: packageId,
    created_at: created,
    need_type: need,
    recipe,
    goal: meta.label,
    cleaned_need: cleaned || "unspecified agent workload",
    row_count: rows.length,
    columns,
    jsonl: rows.map((r) => JSON.stringify(r)).join("\n"),
    schema: JSON.stringify(schema, null, 2),
    preview: rows.slice(0, 6),
    validated: rows.length > 0 && columns.length > 0,
    agent_kind: true,
    slogan: "Taking messy data, making it agent-kind.",
    price_usd: meta.price,
  };
}

module.exports = {
  PAY_TO,
  NETWORK,
  MARKETPLACE,
  RECIPES,
  cors,
  hasPayment,
  paymentRequired,
  refine,
};
