# Envoi chiffré des coins (pour améliorer le modèle)

Le code est livré et **désactivé** tant que `SHARE_CFG` (dans `index.html`) est vide. Rien ne part sans le déploiement ci-dessous.

## Principe
1. L'utilisateur coche une case d'accord (à chaque envoi) et choisit « position floutée (carré d'environ 500 m) » (par défaut) ou « exacte ».
2. Le navigateur chiffre les coins **avant** l'envoi (ECDH P-256 éphémère + HKDF-SHA256 + AES-256-GCM) avec la **clé publique** de l'auteur. Seule la clé privée, que seul l'auteur possède, déchiffre.
3. Un Worker Cloudflare (`partage/worker.js`) reçoit le paquet chiffré et le range dans un **dépôt GitHub privé** (`inbox/AAAA-MM/<id>.json`). Il ne peut rien lire.
4. Pour caler le modèle, l'auteur clone le dépôt privé et lance `partage/decrypt.mjs` sur son ordinateur.

## Données
- **Envoyé** : espèce, latitude/longitude (floutée ou exacte), mois, précision. Un code de suppression (seul son hash SHA-256 est stocké).
- **Jamais envoyé** : nom du coin, photos, identité, alertes. Aucun compte, aucun cookie.
- **Côté Worker** : adresse IP lue uniquement par le compteur anti-abus de Cloudflare (5 requêtes/minute/IP), non stockée par le code ; date réduite au mois ; pas de journal applicatif.
- Chaque coin n'est envoyé qu'une fois (suivi local).

## Anti-abus
Origine obligatoire (`ALLOWED_ORIGIN`), JSON strict, taille maximale 64 Ko (≈ 500 coins), formats vérifiés, limite de débit. Un envoi malveillant reste du texte chiffré : il ne peut ni attaquer le site, ni être lu. Il peut seulement polluer les données ; à l'analyse, ignorer les coins hors Vaud, hors saison ou en doublon. Si le dépôt grossit trop, activer Turnstile (CAPTCHA de Cloudflare) sur `/submit`.

## LPD / RGPD
- Base légale : consentement explicite, libre et révocable (case à cocher non pré-cochée, texte de finalité).
- Finalité unique : améliorer le modèle ; aucune publication, aucune revente.
- Minimisation : pas de nom, pas de photo, flou par défaut, mois seulement.
- Suppression à la demande : bouton « Effacer mes envois » ou « code de suppression » (valable depuis un autre appareil). Le Worker vérifie le secret avant d'effacer. La suppression se fait dans le dépôt privé ; l'historique git peut conserver une version chiffrée : réécrire l'historique (ou recréer le dépôt) si demandé, après avoir extrait ce qui doit rester.
- Les positions exactes de lieux privés peuvent être sensibles : avertissement affiché dans l'app. Sauvegardez la clé privée (sans elle, tout est perdu, c'est voulu) ; elle ne va jamais dans un dépôt.
- Responsable du traitement : Florian Wyss (affiché dans la section d'envoi de l'app). Contact : formulaire de l'app (route `/contact` du Worker), qui crée une issue dans le dépôt privé ; GitHub prévient le propriétaire par e-mail, sans afficher son adresse. Le jeton doit avoir les droits Contents et Issues.

## Mise en service (à faire par Florian, ≈ 15 min)
1. `node partage/keygen.mjs` : crée `cle-privee.jwk` (à sauvegarder hors ligne) et affiche la clé publique.
2. Créer le dépôt **privé** `wyssflorian/magichampi-coins-prive` (avec un premier fichier, par ex. un README).
3. GitHub › Settings › Developer settings › Fine-grained token : un seul dépôt (le privé), droit **Contents : lecture et écriture**, expiration 1 an.
4. `cd partage && npx wrangler deploy`, puis `npx wrangler secret put GITHUB_TOKEN` (coller le jeton). Noter l'URL `https://champi-partage.<compte>.workers.dev`.
5. Dans `index.html`, remplir `SHARE_CFG={url:"<url du Worker>",pub:<clé publique>}` et merger.
6. Tester : un coin avec espèce, envoi, vérifier le fichier chiffré dans `inbox/` ; puis « Effacer mes envois » et vérifier qu'il disparaît. Test sans réseau : `node partage/selftest.mjs`.
