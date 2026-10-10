const { cors, MARKETPLACE, NETWORK, PAY_TO } = require("./_lib");

module.exports = (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const host = `https://${req.headers.host}`;
  res.status(200).json({
    name: "nicje-data-refinery",
    description: "Taking messy data, making it agent-kind.",
    protocol: "x402",
    marketplace: MARKETPLACE,
    native_skill: `${MARKETPLACE}/api/skills/nicje`,
    pay_to: PAY_TO,
    network: NETWORK,
    status: "paused", // HOTFIX 2026-10-09: unlisted until verify+settle ships
    services: [],
  });
};
