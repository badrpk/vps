/**
 * DigitalOcean-class droplet/control-plane service (in-memory demo).
 * Mounted by competitive_plane.js
 */
const crypto = require("crypto");
const uid = (p) => `${p}_${crypto.randomBytes(4).toString("hex")}`;
const iso = () => new Date().toISOString();

const REGIONS = [
  { slug: "nyc1", name: "New York 1", available: true },
  { slug: "sgp1", name: "Singapore 1", available: true },
  { slug: "fra1", name: "Frankfurt 1", available: true },
  { slug: "khi1", name: "Karachi 1", available: true },
];
const SIZES = [
  { slug: "s-1vcpu-1gb", vcpus: 1, memory_mb: 1024, disk_gb: 25, price_monthly_usd: 6 },
  { slug: "s-2vcpu-2gb", vcpus: 2, memory_mb: 2048, disk_gb: 50, price_monthly_usd: 12 },
  { slug: "s-4vcpu-8gb", vcpus: 4, memory_mb: 8192, disk_gb: 160, price_monthly_usd: 48 },
];
const SSH_KEYS = [];
const DROPLETS = [];
const ACTIONS = [];
let BALANCE_USD = 50;

function listRegions() { return REGIONS; }
function listSizes() { return SIZES; }
function listKeys() { return SSH_KEYS; }
function listDroplets() { return DROPLETS; }
function getBalance() { return { balance_usd: BALANCE_USD, currency: "USD" }; }

function addKey(name, public_key) {
  const k = { id: uid("key"), name, public_key, fingerprint: crypto.createHash("md5").update(public_key).digest("hex"), created_at: iso() };
  SSH_KEYS.push(k);
  return k;
}

function createDroplet({ name, region, size, image = "ubuntu-22-04", ssh_keys = [] }) {
  const sz = SIZES.find(s => s.slug === size);
  const rg = REGIONS.find(r => r.slug === region);
  if (!sz || !rg) throw new Error("invalid_region_or_size");
  if (BALANCE_USD < sz.price_monthly_usd) throw new Error("insufficient_balance");
  const d = {
    id: uid("d"), name: name || "droplet", region: rg.slug, size: sz.slug, image,
    status: "active", vcpus: sz.vcpus, memory_mb: sz.memory_mb, disk_gb: sz.disk_gb,
    networks: { v4: [{ ip_address: `10.${Math.floor(Math.random()*200)}.${Math.floor(Math.random()*200)}.${Math.floor(Math.random()*200)}`, type: "private" },
                      { ip_address: `203.0.113.${Math.floor(Math.random()*200)}`, type: "public" }] },
    ssh_keys, created_at: iso(), monthly_usd: sz.price_monthly_usd,
  };
  DROPLETS.push(d);
  BALANCE_USD = Math.round((BALANCE_USD - sz.price_monthly_usd / 30) * 100) / 100;
  const action = { id: uid("act"), droplet_id: d.id, type: "create", status: "completed", started_at: iso(), completed_at: iso() };
  ACTIONS.push(action);
  return { droplet: d, action };
}

function dropletAction(id, type) {
  const d = DROPLETS.find(x => x.id === id);
  if (!d) throw new Error("not_found");
  if (type === "reboot" || type === "power_cycle") d.status = "active";
  if (type === "power_off") d.status = "off";
  if (type === "power_on") d.status = "active";
  if (type === "destroy") {
    const i = DROPLETS.indexOf(d);
    DROPLETS.splice(i, 1);
  }
  const action = { id: uid("act"), droplet_id: id, type, status: "completed", started_at: iso(), completed_at: iso() };
  ACTIONS.push(action);
  return { droplet: d, action };
}

function metrics(id) {
  const d = DROPLETS.find(x => x.id === id);
  if (!d) throw new Error("not_found");
  return {
    droplet_id: id,
    cpu_percent: Math.round(Math.random() * 60 + 5),
    mem_percent: Math.round(Math.random() * 50 + 20),
    net_in_mbps: Math.round(Math.random() * 20),
    net_out_mbps: Math.round(Math.random() * 15),
    disk_percent: Math.round(Math.random() * 40 + 10),
    at: iso(),
  };
}

module.exports = {
  listRegions, listSizes, listKeys, listDroplets, getBalance, addKey, createDroplet, dropletAction, metrics, ACTIONS,
};
