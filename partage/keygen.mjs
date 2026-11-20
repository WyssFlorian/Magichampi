// Génère la paire de clés du propriétaire. À lancer UNE fois, sur votre ordinateur :  node partage/keygen.mjs
// - cle-privee.jwk : à garder hors de tout dépôt (gestionnaire de mots de passe + sauvegarde hors ligne). Sans elle, les envois sont illisibles pour toujours.
// - la clé PUBLIQUE s'affiche : elle se colle dans index.html (SHARE_CFG.pub).
import { writeFileSync, existsSync } from "node:fs";
if (existsSync("cle-privee.jwk")) { console.error("cle-privee.jwk existe déjà : je n'écrase rien."); process.exit(1); }
const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const priv = await crypto.subtle.exportKey("jwk", kp.privateKey);
const pub = await crypto.subtle.exportKey("jwk", kp.publicKey);
writeFileSync("cle-privee.jwk", JSON.stringify(priv), { mode: 0o600 });
console.log("Clé privée écrite dans cle-privee.jwk (NE JAMAIS la publier ni la commiter).");
console.log("Clé publique à coller dans index.html :\n" + JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }));
