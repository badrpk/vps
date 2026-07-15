/**
 * Standalone DigitalOcean-parity control plane on PORT 3001 (or COMPETITIVE_PORT).
 * Complements existing multi-service server.js without breaking it.
 */
const http = require("http");
const { URL } = require("url");
const plane = require("./services/droplets");
const PORT = process.env.COMPETITIVE_PORT || process.env.PORT || 3001;

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(obj, null, 2));
}
function body(req) {
  return new Promise((r) => { let d=""; req.on("data", c => d+=c); req.on("end", () => { try{r(JSON.parse(d||"{}"))}catch{r({})} }); });
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = u.pathname.replace(/\/$/, "") || "/";
  try {
    if (p === "/" || p === "/health" || p === "/v2") {
      return json(res, 200, { ok: true, service: "vps-pk-control-plane", version: "2.0.0",
        parity_target: "DigitalOcean Droplets API", routes: [
          "/v2/regions", "/v2/sizes", "/v2/account", "/v2/account/keys",
          "/v2/droplets", "/v2/droplets/{id}/actions", "/v2/droplets/{id}/metrics", "/capabilities"
        ]});
    }
    if (p === "/capabilities") return json(res, 200, { ok: true, competitor: "DigitalOcean",
      features: ["regions", "sizes", "ssh_keys", "droplet_crud", "power_actions", "metrics", "billing_balance"] });
    if (p === "/v2/regions") return json(res, 200, { regions: plane.listRegions() });
    if (p === "/v2/sizes") return json(res, 200, { sizes: plane.listSizes() });
    if (p === "/v2/account") return json(res, 200, { account: plane.getBalance() });
    if (p === "/v2/account/keys" && req.method === "GET") return json(res, 200, { ssh_keys: plane.listKeys() });
    if (p === "/v2/account/keys" && req.method === "POST") {
      const b = await body(req);
      return json(res, 201, { ssh_key: plane.addKey(b.name || "key", b.public_key || "ssh-rsa AAAA") });
    }
    if (p === "/v2/droplets" && req.method === "GET") return json(res, 200, { droplets: plane.listDroplets() });
    if (p === "/v2/droplets" && req.method === "POST") {
      const b = await body(req);
      const out = plane.createDroplet(b);
      return json(res, 202, out);
    }
    if (p.startsWith("/v2/droplets/") && p.endsWith("/actions") && req.method === "POST") {
      const id = p.split("/")[3];
      const b = await body(req);
      return json(res, 201, plane.dropletAction(id, b.type || "reboot"));
    }
    if (p.startsWith("/v2/droplets/") && p.endsWith("/metrics")) {
      const id = p.split("/")[3];
      return json(res, 200, { metrics: plane.metrics(id) });
    }
    if (p.startsWith("/v2/droplets/") && req.method === "GET") {
      const id = p.split("/")[3];
      const d = plane.listDroplets().find(x => x.id === id);
      return d ? json(res, 200, { droplet: d }) : json(res, 404, { error: "not_found" });
    }
    json(res, 404, { error: "not_found" });
  } catch (e) {
    json(res, 400, { ok: false, error: e.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`VPS-PK control plane (DO parity) http://127.0.0.1:${PORT}`));
