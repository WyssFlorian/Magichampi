// Chiffrement hybride du partage de coins (ECDH P-256 éphémère + HKDF-SHA256 + AES-256-GCM).
// Même algorithme que le client (index.html, « contribution chiffrée ») ; utilisé par keygen/decrypt/selftest.
const enc = new TextEncoder(), dec = new TextDecoder();
export const b64u = (u8) => Buffer.from(u8).toString("base64url");
export const unb64u = (s) => new Uint8Array(Buffer.from(s, "base64url"));
const INFO = enc.encode("champi-partage-v1");

async function aesKey(shared, usage) {
  const k = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: INFO }, k,
    { name: "AES-GCM", length: 256 }, false, [usage]);
}
export async function encrypt(pubJwk, obj) {
  const pub = await crypto.subtle.importKey("jwk", pubJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, eph.privateKey, 256);
  const key = await aesKey(shared, "encrypt"), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))));
  const epk = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  return { v: 1, epk: b64u(epk), iv: b64u(iv), ct: b64u(ct) };
}
export async function decrypt(privJwk, env) {
  const priv = await crypto.subtle.importKey("jwk", privJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const epk = await crypto.subtle.importKey("raw", unb64u(env.epk), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: epk }, priv, 256);
  const key = await aesKey(shared, "decrypt");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(env.iv) }, key, unb64u(env.ct));
  return JSON.parse(dec.decode(pt));
}
