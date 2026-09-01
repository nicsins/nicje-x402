const { cors, MARKETPLACE, NETWORK, PAY_TO } = require("./_lib");

module.exports = (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  res.status(200).json({
    status: "ok",
    service: "nicje-data-refinery",
    marketplace: MARKETPLACE,
    native_skill: `${MARKETPLACE}/api/skills/nicje`,
    x402_enabled: true,
    pay_to: PAY_TO,
    network: NETWORK,
  });
};
