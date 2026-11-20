// Test sans réseau : client (chiffrement) -> Worker (simulé GitHub) -> déchiffrement ; suppression avec bon/mauvais secret ; refus de formats invalides.
//   node partage/selftest.mjs
import worker from "./worker.js";
import { encrypt, decrypt } from "./crypto.mjs";
import assert from "node:assert/strict";
const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const pub = await crypto.subtle.exportKey("jwk", kp.publicKey), priv = await crypto.subtle.exportKey("jwk", kp.privateKey);
const files = new Map();
globalThis.fetch = async (url, init = {}) => {
  const p = new URL(url).pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ""), m = init.method || "GET", body = init.body && JSON.parse(init.body);
  if (m === "PUT") { files.set(p, Buffer.from(body.content, "base64").toString()); return new Response("{}", { status: 201 }); }
  if (m === "DELETE") { files.delete(p); return new Response("{}"); }
  return files.has(p) ? new Response(JSON.stringify({ sha: "x", content: Buffer.from(files.get(p)).toString("base64") })) : new Response("{}", { status: 404 });
};
const env = { REPO: "o/r", ALLOWED_ORIGIN: "https://o.github.io", GITHUB_TOKEN: "t" };
const call = (path, b, origin = env.ALLOWED_ORIGIN) => worker.fetch(new Request("https://w" + path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(b) }), env);
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, "0")).join("");

const secret = "0123456789abcdef0123456789abcdef";
const coins = [{ sp: "tubaeformis", lat: 46.52, lng: 6.63, date: "2026-10" }];
const e = await encrypt(pub, { coins });
let r = await call("/submit", { ...e, dh: await sha(secret) });
assert.equal(r.status, 200); const { id } = await r.json();
const [path, stored] = [...files][0];
assert.ok(!stored.includes("tubaeformis") && !stored.includes("46.52"), "rien de lisible dans le stockage");
assert.deepEqual((await decrypt(priv, JSON.parse(stored))).coins, coins);
assert.equal((await call("/submit", { ...e, dh: await sha(secret) }, "https://evil.example")).status, 403);
assert.equal((await call("/submit", { ...e, ct: "!!", dh: await sha(secret) })).status, 400);
const month = path.split("/")[1];
assert.equal((await call("/delete", { id, secret: "x".repeat(32), months: [month] })).status, 403);
assert.equal(files.size, 1);
assert.equal((await (await call("/delete", { id, secret, months: [month] })).json()).deleted, true);
assert.equal(files.size, 0);
console.log("OK : chiffrement, stockage illisible, refus origine/format, suppression par secret.");
