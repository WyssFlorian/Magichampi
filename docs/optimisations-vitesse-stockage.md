# Analyse des optimisations : vitesse et stockage (23 nov. 2026)

Analyse seule : aucun code de la carte n'a été modifié. Mesures faites avec Chromium (Playwright), profil iPhone 13 (écran tactile, `MOBILE=true`), processeur ralenti ×4 pour approcher un iPhone réel, réseau local. Scripts rejouables dans `tools/profil/`. Les durées « ×1 » sont celles d'un processeur de serveur, un téléphone est typiquement 3 à 5 fois plus lent.

## 1. Pourquoi les cases « ★ Stars / Bons / Intéressants » sont lentes

**Cause trouvée : le cache de calculs par espèce est trop petit pour le mode « Forte concentration ».**

- En mode une espèce, cocher une catégorie coûte 0,2 à 0,5 s (×4) : correct.
- En mode « Forte concentration » (`state.sp==="multi"`), `renderInner()` appelle `classesFor()` puis `staticFor()` pour chaque espèce active (jusqu'à 80 avec les 3 catégories). `staticFor()` calcule, pour chaque cellule de la région, l'aptitude (`aptAt`, une dizaine de `Math.pow`), le rang en percentile et les statistiques des zones.
- Le cache `staticCache` ne garde que **10 résultats sur mobile (12 sur ordinateur)** (`STATIC_MAX`). Avec 40 à 80 espèces, le cache est vidé en boucle (LRU) : **chaque clic recalcule toutes les espèces depuis zéro**, même celles qui n'ont pas changé.

Mesures (région de ~0,8 M de cellules chargées, mode concentration) :

| Action | ×1 | ×4 (≈ téléphone) |
|---|---|---|
| ★ seul → + Bons (41 espèces) | 5,1 s | **48,6 s** |
| + Intéressants (80 espèces) | – | **24,9 s** (cache déjà partiellement chaud) |
| Décocher Bons | – | 6,7 s |
| Mode une espèce, cocher une catégorie | – | 0,2 à 0,5 s |

Le temps est proportionnel au nombre de cellules : les grandes régions (nyn ≈ 6 M, bro/gdv ≈ 4 M de cellules dans `data.json`) sont 5 à 8 fois plus lentes. Le fil principal est bloqué pendant tout le calcul (aucun indicateur, l'écran semble figé).

Répartition du temps CPU (×1, 41 espèces, 5,1 s) : `staticFor` 1,5 s (en propre) ; chaîne `aptAt` ≈ 2,3 s (`wslF` 0,54, `soilF` 0,36, `hostW` 0,31, `habF` 0,24, `altW` 0,22, `usable` 0,20, `thrClass` 0,12) ; `classesFor` 0,28 s ; ramasse-miettes 0,1 s.

Autres coûts constatés à chaque `render()` (petits) : `huntUpdate` ≈ 60 ms (×4), `renderSpeciesList` ≈ 30 ms (×4).

## 2. Optimisations proposées, classées

Coût en % du quota hebdomadaire = tokens estimés × 2,7 % par 100 k, marge +10 % incluse.

| # | Optimisation | Gain estimé | Effort | Risque | Coût quota |
|---|---|---|---|---|---|
| V1 | **Cache des points par catégorie** : en mode concentration, garder 3 tableaux de points (1 octet/cellule chacun, un par catégorie) ; cocher/décocher une catégorie = additionner des tableaux déjà calculés. Invalidation seulement si espèces masquées, saison, options (`excl`, `resp`, `acc`, `yr`) ou météo changent. Ajouter un indicateur « Calcul en cours… » et découper le premier calcul en tranches (`setTimeout`) pour ne plus figer l'écran. | Bascule d'une catégorie : de 5 à 50 s à **< 0,1 s** après le premier calcul. Mémoire : +3 octets/cellule (≈ 2,4 Mo pour 0,8 M de cellules) au lieu de 18 Mo par espèce. | Petit (≈ 150 k tokens) | Faible à moyen (touche `multiCache`, seuils et légende) | **≈ 4,5 %** |
| V2 | **Tables précalculées dans `aptAt`** : remplacer les `Math.pow` par cellule par des tables indexées (conifères 0–100, pente 0–90, altitude par pas de 10 m, classes de sol/habitat/WSL) | Premier calcul 2 à 3× plus rapide (5 s → ~2 s ×1) | Moyen (≈ 220 k) | Moyen : résultats doivent rester identiques (test de non-régression sur les classes de toutes les espèces) | **≈ 6,5 %** |
| V3 | **Calcul dans des Web Workers** (une tranche d'espèces par worker) | Premier calcul 3 à 4× plus rapide, écran fluide | Grand (≈ 450 k) | Élevé (copie des grilles, mémoire iPhone) | **≈ 13 %** |
| V4 | Petits gains : `huntUpdate` et `renderSpeciesList` seulement si leurs entrées changent ; ne pas redessiner couches et listes lors d'un simple changement de catégorie | ≈ 90 ms (×4) par clic | Petit (≈ 60 k) | Faible | **≈ 1,8 %** |

Ordre recommandé : **V1 d'abord** (règle presque tout le problème visible), puis V2 si le premier calcul reste long sur les grandes régions. V3 seulement si nécessaire.

## 3. Stockage (site ≈ 740 Mo, limite GitHub Pages 1 Go ; `.git` ≈ 680 Mo)

Répartition du site : tuiles JPEG **604 Mo (82 %)**, JSON 117 Mo (grilles `grid/c_*.json` ≈ 6 à 16 Mo par région, `data.json`, graphes), GeoJSON ≈ 49 Mo. Dans les tuiles : zoom 15 = **393 Mo** (carte 210 + photo 183), zoom 14 = 108 Mo, zoom 16 = 41 Mo (région ple seulement, zone des Pléiades).

| # | Optimisation | Gain estimé | Effort | Risque | Coût quota |
|---|---|---|---|---|---|
| S1 | **Tuiles JPEG → WebP qualité 75** (essai sur 4 mosaïques : −35 à −40 %). Alternative sans changement de format : JPEG q70 progressif, −28 %. | **≈ −220 Mo** sur le site (740 → ≈ 520 Mo) ; hors ligne par région ≈ −40 à −45 Mo | Moyen (≈ 200 k : conversion des 8 régions, adaptation du chargeur de mosaïques, `files.json`, contrôle visuel) | Moyen : WebP exige iOS 14+ ; `.git` grossit de ≈ +350 Mo (nouveaux fichiers) sans purger l'historique | **≈ 6 %** |
| S2 | **Hors ligne « carte seule » ou « photo seule »** au choix (aujourd'hui les deux fonds sont téléchargés) | ≈ −40 à −55 Mo de téléchargement et de stockage téléphone par région (115 à 127 Mo → ≈ 70 Mo) | Petit (≈ 100 k) | Faible | **≈ 3 %** |
| S3 | Zoom 16 de ple : le limiter à la zone la plus utile ou à la photo seule | −20 à −40 Mo (une seule région) | Petit | Faible (perte de détail au zoom 16) | **≈ 2 %** |
| S4 | Grilles `grid/*.json` : base64 dans JSON (+33 %) → fichiers binaires | ≈ −25 Mo au dépôt ; rien sur le réseau (déjà compressé en gzip par Pages) | Moyen (≈ 150 k) | Moyen | ≈ 4,5 % |
| S5 | GeoJSON : coordonnées déjà à 5 décimales, rien à gagner ; `graphe.json` est déjà chargé à la demande | – | – | – | – |
| S6 | Doublons exacts entre régions : 14 fichiers, ≈ 4 Mo | négligeable | – | – | – |

Ordre recommandé : **S2** (rapide, utile tout de suite aux téléphones), puis **S1** (gros gain, à valider visuellement sur une région avant les autres).

## 4. Mode hors ligne et poids des tuiles : vérifié

- `files.json` de chaque région liste bien tous les fichiers (data, grilles, GeoJSON, **toutes les tuiles**, `zone.js`) ; aucun fichier manquant dans les 9 zones. Poids hors ligne : ple 127 Mo, gdv 127, nyn 115, bro 111, chb 110, pde 76, vul 58, lsn 45, vue d'ensemble `vd` 4 Mo.
- Le téléchargement reprend là où il s'est arrêté (fichiers déjà en cache ignorés), gère le manque de place (`QuotaExceededError`) et demande le stockage persistant.
- Le service worker (`sw.js`) met les tuiles et grilles en cache sans limite de taille côté code ; la limite est celle du navigateur (Safari iOS peut purger un site peu utilisé : le stockage persistant n'est pas garanti sur iPhone).
- Démarrage (ple, ×1) : première carte colorée en 1,4 s, 4,9 s à ×4 ; 9,4 Mo transférés dont 5,9 Mo de grilles ; le reste (tuiles) est chargé à la demande. Ce n'est pas un problème comparé à la section 1.

## 5. Recommandation

1. Lancer **V1** (≈ 4,5 % du quota) : corrige le temps de réponse des cases.
2. Lancer **S2** (≈ 3 %) puis **S1** (≈ 6 %) pour le stockage.
3. V2, V3, S3, S4 : à reprendre selon les résultats.

Total V1 + S1 + S2 ≈ 13,5 % du quota hebdomadaire.
