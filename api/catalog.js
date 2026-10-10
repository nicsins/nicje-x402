const { cors, MARKETPLACE, NETWORK, PAY_TO, RECIPES } = require("./_lib");

module.exports = (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  res.status(200).json({
    name: "nicje-data-refinery",
    version: "1.0.0",
    slogan: "Taking messy data, making it agent-kind.",
    marketplace: MARKETPLACE,
    native_skill: `${MARKETPLACE}/api/skills/nicje`,
    protocol: "x402",
    network: NETWORK,
    payTo: PAY_TO,
    currency: "USDC",
    services: Object.entries(RECIPES).map(([id, meta]) => ({
      id,
      name: meta.label,
      path: `/api/recipes/${id}/run`,
      method: "POST",
      price_usd: meta.price,
    })),
  });
};
