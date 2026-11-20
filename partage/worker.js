// Cloudflare Worker : reçoit des envois DÉJÀ CHIFFRÉS (le Worker ne peut pas les lire) et les range dans un dépôt GitHub privé.
// Secrets (jamais dans le code) : GITHUB_TOKEN (jeton à droits limités, Contents lecture/écriture sur le seul dépôt privé).
// Variables (wrangler.toml) : REPO ("wyssflorian/magichampi-coins-prive"), ALLOWED_ORIGIN.
// Aucune adresse IP, aucun journal : l'IP ne sert qu'au compteur anti-abus de Cloudflare (binding RL), sans être stockée par ce code.
const MAX_BODY = 64 * 1024;
const B64U = /^[A-Za-z0-9_-]+$/;
const HEX64 = /^[0-9a-f]{64}$/;

const cors = (env) => ({ "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" });
const json = (env, status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...cors(env), "Content-Type": "application/json", "Cache-Control": "no-store" } });

const gh = (env, path, init = {}) => fetch(`https://api.github.com/repos/${env.REPO}/contents/${path}`, {
  ...init, headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "champi-partage", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...(init.headers || {}) } });

const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function readBody(req) {
  const len = +req.headers.get("content-length") || 0;
  if (len > MAX_BODY) return null;
  const t = await req.text();
  if (t.length > MAX_BODY) return null;
  try { return JSON.parse(t); } catch { return null; }
}

async function submit(env, b) {
  // forme stricte : on ne stocke que des champs attendus, de la bonne longueur
  if (!b || b.v !== 1 || typeof b.epk !== "string" || typeof b.iv !== "string" || typeof b.ct !== "string" || typeof b.dh !== "string") return json(env, 400, { error: "format" });
  if (!B64U.test(b.epk) || b.epk.length !== 87 || !B64U.test(b.iv) || b.iv.length !== 16 || !B64U.test(b.ct) || b.ct.length < 24 || b.ct.length > 60000 || !HEX64.test(b.dh)) return json(env, 400, { error: "format" });
  const id = crypto.randomUUID().replace(/-/g, "");
  const month = new Date().toISOString().slice(0, 7);          // seul le mois est gardé, pas l'heure
  const doc = { v: 1, id, dh: b.dh, epk: b.epk, iv: b.iv, ct: b.ct };
  const r = await gh(env, `inbox/${month}/${id}.json`, { method: "PUT", body: JSON.stringify({ message: "envoi", content: b64(JSON.stringify(doc)) }) });
  if (!r.ok) return json(env, 502, { error: "stockage" });
  return json(env, 200, { id });
}

async function remove(env, b) {
  // suppression à la demande : l'utilisateur prouve qu'il est l'auteur en présentant le secret dont le hash est stocké
  if (!b || !/^[0-9a-f]{32}$/.test(b.id || "") || typeof b.secret !== "string" || b.secret.length < 16 || b.secret.length > 128 || !Array.isArray(b.months)) return json(env, 400, { error: "format" });
  const dh = await sha256hex(b.secret);
  const months = b.months.filter((m) => /^\d{4}-\d{2}$/.test(m)).slice(0, 24);
  for (const m of months) {
    const r = await gh(env, `inbox/${m}/${b.id}.json`);
    if (r.status !== 200) continue;
    const f = await r.json();
    let doc; try { doc = JSON.parse(atob(f.content.replace(/\n/g, ""))); } catch { continue; }
    if (doc.dh !== dh) return json(env, 403, { error: "secret" });
    const d = await gh(env, `inbox/${m}/${b.id}.json`, { method: "DELETE", body: JSON.stringify({ message: "suppression à la demande", sha: f.sha }) });
    return d.ok ? json(env, 200, { deleted: true }) : json(env, 502, { error: "stockage" });
  }
  return json(env, 200, { deleted: false });   // déjà absent : même réponse, pour ne rien révéler
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    if (req.method !== "POST" || (u.pathname !== "/submit" && u.pathname !== "/delete")) return json(env, 404, { error: "introuvable" });
    if (req.headers.get("Origin") !== env.ALLOWED_ORIGIN) return json(env, 403, { error: "origine" });
    if (!(req.headers.get("content-type") || "").includes("application/json")) return json(env, 415, { error: "type" });
    if (env.RL) { const ok = await env.RL.limit({ key: req.headers.get("CF-Connecting-IP") || "?" }); if (!ok.success) return json(env, 429, { error: "trop de requetes" }); }
    const b = await readBody(req);
    return u.pathname === "/submit" ? submit(env, b) : remove(env, b);
  },
};
