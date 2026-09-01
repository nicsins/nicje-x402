const { cors, hasPayment, paymentRequired, refine, RECIPES } = require("../../_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const name = req.query.name || "custom";
  const meta = RECIPES[name] || RECIPES.custom;
  if (!hasPayment(req)) {
    return paymentRequired(
      req,
      res,
      meta.price,
      `NICJE ${meta.label} — taking messy data, making it agent-kind.`,
    );
  }
  const body = req.body || {};
  const raw = String(body.raw || "").trim();
  if (!raw) return res.status(400).json({ error: "raw is required" });
  const pkg = refine(raw, String(body.request || body.need || ""), name);
  return res.status(200).json(pkg);
};
