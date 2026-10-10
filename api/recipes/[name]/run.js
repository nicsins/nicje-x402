const { cors, refine, RECIPES } = require("../../_lib");
const { withPayment } = require("../../_x402");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const name = RECIPES[req.query.name] ? req.query.name : "custom";
  const meta = RECIPES[name];
  return withPayment(
    req,
    res,
    {
      usd: meta.price,
      path: `/api/recipes/${name}/run`,
      description: `NICJE ${meta.label}: taking messy data, making it agent-kind.`,
    },
    async () => {
      const body = req.body || {};
      const raw = String(body.raw || "").trim();
      if (!raw) return { status: 400, body: { error: "raw is required" } };
      return { status: 200, body: refine(raw, String(body.request || body.need || ""), name) };
    },
  );
};
