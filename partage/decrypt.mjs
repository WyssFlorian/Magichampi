// Lit les envois du dépôt privé (cloné en local) et écrit un fichier de coins en clair, pour le calage du modèle.
// Usage : node partage/decrypt.mjs cle-privee.jwk <dossier-inbox-du-depot-prive> sortie.json
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { decrypt } from "./crypto.mjs";
const [keyFile, dir, out] = process.argv.slice(2);
if (!out) { console.error("Usage : node decrypt.mjs cle-privee.jwk <inbox> sortie.json"); process.exit(1); }
const priv = JSON.parse(readFileSync(keyFile, "utf8"));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".json") ? [p] : []; });
const rows = []; let bad = 0;
for (const f of walk(dir)) {
  try { const env = JSON.parse(readFileSync(f, "utf8")); const o = await decrypt(priv, env); for (const c of o.coins || []) rows.push({ ...c, envoi: env.id }); }
  catch { bad++; }
}
writeFileSync(out, JSON.stringify(rows));
console.log(rows.length + " coins lus, " + bad + " fichiers illisibles.");
