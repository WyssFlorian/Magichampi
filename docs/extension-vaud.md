# Extension de la carte à tout le canton de Vaud

Demande de Florian (20 nov. 2026) : couvrir tout le canton, affichage découpé par région téléchargeable séparément hors ligne, bande de 1 km autour de chaque région pour que les cartes se chevauchent.

## Découpage (`tools/zones_vaud.py` → `zones.js`)
| id | région | statut | emprise nominale (O, S, E, N) |
|---|---|---|---|
| ple | Riviera-Chablais et Veveyse (FR) | publiée | 6,74 – 46,35 – 7,06 – 46,62 |
| lsn | Région lausannoise | publiée | 6,45 – 46,45 – 6,75 – 46,63 |
| gdv | Gros-de-Vaud | publiée | 6,26 – 46,53 – 6,70 – 46,86 |
| nyn | La Côte, Nyon, Jura vaudois (Vallée de Joux ouest) | **publiée (lot 2)** | 6,06 – 46,28 – 6,52 – 46,70 |
| bro | Broye (Moudon, Lucens, Payerne) | **publiée (lot 3)** | 6,68 – 46,60 – 7,00 – 46,99 |
| vul | Vully et Avenches | **publiée (lot 4)** | 6,98 – 46,78 – 7,26 – 46,99 |
| chb | Chablais alpin (Bex, Ormonts, Gryon) | **publiée (lot 5)** | 6,74 – 46,18 – 7,26 – 46,37 |
| pde | Pays-d'Enhaut et Diablerets | **publiée (lot 6)** | 7,04 – 46,35 – 7,26 – 46,62 |

Reste non couvert : environ 30 km² d'eau du lac de Neuchâtel (aucune forêt).
Les emprises nominales voisines se recouvrent déjà d'environ 1,5 km ; chaque nouvelle région reçoit en plus une bande de 1 km (`bbox` de `zones.js`), soit au moins 2,5 km de recouvrement. Les trois régions publiées gardent leurs emprises (pas de nouvelle génération).
Le chargement suit la vue : on ne change de région que lorsque le centre de la vue sort de l'emprise de la région chargée (hystérésis), donc la bande de 1 km est visible des deux côtés.

## Lot 1 (cette PR) : socle
- `zones.js` : registre des régions (`ok:1` = données publiées dans `<id>/`). Passer `ok` à 1 (`python3 tools/zones_vaud.py nyn`) publie la région dans la page.
- `index.html` : détection de région générique (plus de liste codée en dur), menu « Météo et outils › Régions hors ligne » avec téléchargement et suppression séparés par région (la région affichée garde son gros bouton).
- `sw.js` : le fichier était vide depuis la fusion des PR empilées (PR 45), donc rien n'était servi hors ligne malgré le bouton. Version du 20 nov. rétablie.

## Lots suivants : une région par PR
Chaîne par région : MNT swissALTI3D, forêt et mélange LFI, hauteur de végétation, pentes/TPI, GeoCover (sol), routes, cours d'eau, arrêts TP, parkings, sentiers, réserves, SwissFungi, grille 25 m en tuiles, fond de carte (carte nationale + orthophoto), puis modèle calibré par région, seuils recalculés (`tools/seuils.js`), zones interdites, chasse (calendrier VD), VAPKO.
**Couche d'essences WSL dans les nouvelles régions : oui** (décision de Florian du 20 nov. ; le point légal avec le WSL reste à régler avant la diffusion officielle). Étape à lancer pour chaque région une fois ses tuiles `<id>/grid/` et son `<id>/zone.js` générés, avant la publication :
```
bash tools/ajouter_wsl_region.sh <id> <raster WSL .tif>
```
Elle ajoute la couche `wsl` aux tuiles (`tools/wsl_vers_tuiles.py`, idempotent), recalcule les seuils de classes de la région (`tools/seuils.js`, aussi pour une région `ok:0`) et les écrit dans `<id>/zone.js` (`ZONE.MAP_THR_V6`, `tools/ecrire_seuils.py`). Le modèle (poids calibrés de la PR 40 : essence WSL ×0,4, résineux ×0,1 ; pixels non classés = moyenne de l'espèce sur la région) est déjà dans `index.html` : rien d'autre à brancher. Testé sur `lsn` : tuiles et seuils identiques à ceux du dépôt.
Raster : `cat tree_species_map_aoa_raster.tif.part* > r.tif` dans `data-wsl-essences/` du dépôt privé `app-champignons` (branche `claude/project-thread-if9cgw`, voir `LIRE_MOI.md`) ; ne jamais le versionner ici (`tools/verifier_depot_public.py`).
Couverture vérifiée le 20 nov. sur l'emprise des 8 régions : le raster (toute la Suisse, 10 m) les couvre entièrement ; part des pixels de forêt classés en essence : ple 89 %, lsn 97 %, gdv 96 %, nyn 98 %, bro 87 %, vul 90 %, chb 83 %, pde 81 % (le reste : hors zone d'applicabilité ou série Sentinel-2 incomplète, traité comme neutre). Les Alpes (chb, pde) sont les moins bien classées, et les espèces d'altitude (mélèze, pin cembro rare) sont mal couvertes : le facteur y est moins fiable, à garder en tête pour la validation de ces régions.
Rappel de la validation (PR 40) : elle porte sur 247 relevés des trois premières régions ; à refaire avec les relevés des régions nouvelles quand elle seront prêtes (`ev1`-type, blocs de 5 km).

Estimation (taux réel ≈ 2,5 % de la semaine par 100 k tokens, +10 % de marge = 2,7 %) :
| lot | contenu | tokens estimés | part de la semaine |
|---|---|---|---|
| 1 | socle (cette PR) | ≈ 60 k | ≈ 1,6 % |
| 2 | nyn (première région : remise en route de la chaîne, dont les scripts pointent vers d'anciens dossiers de travail) | ≈ 250 k | ≈ 6,8 % |
| 3-6 | bro, chb, pde, vul (chaîne rodée, une région par PR) | ≈ 100 k chacune | ≈ 2,7 % chacune |
| total | | ≈ 710 k | ≈ 19 % |
Hypothèses : chaque lot nécessite de télécharger 1 à 4 Go de MNT et plusieurs milliers de tuiles de fond (durée machine, peu de tokens). L'incertitude vient surtout du lot 2.

## Poids du dépôt
Une région publiée pèse environ 45 à 125 Mo (fond de carte ≈ 85 %). Les cinq nouvelles régions ajouteraient ≈ 400 à 500 Mo au site (≈ 285 Mo aujourd'hui), proche de la limite recommandée de 1 Go pour GitHub Pages. Parade prévue : fond de carte des nouvelles régions limité aux emprises de forêt (les Alpes sont surtout hors forêt), orthophoto jusqu'au zoom 15 seulement.

## Lot 2 : La Côte, Nyon et Jura vaudois (`nyn/`)
Générée par `pipeline/vd/` du dépôt privé app-champignons (`zones.py`, `dl_zone.py`, `dl_rules.py`, `grid.py`, `extras.py`, `tiles.py`, `mkzone.py`), puis `tools/ajouter_wsl_region.sh nyn` (couche WSL et seuils V6).
- Grille 25 m alignée sur celle du pilote : 2165 × 2834 cellules, 69 tuiles de données, 464 000 cellules de forêt dans la fenêtre de test ; couche WSL : 93,5 % de la forêt classée.
- Sol : GeoCover sur 90,9 % de la forêt (le reste : sol neutre, sans l'atlas géochimique de l'ancienne chaîne, non disponible en données ouvertes). Humidité : TWI du MNT + bilan hydrique OFEV + terrain GeoCover.
- Accès : arrêts TP (OFT) et parkings (swissTLM3D) ; lignes de bus non renseignées dans les fenêtres d'arrêts (la table des lignes ne couvre que les trois premières régions).
- Chasse : calendrier vaudois ; zones sans chasse = districts francs fédéraux et réserves d'oiseaux d'eau ; pas de zones de tir militaires (à compléter si besoin).
- SwissFungi : mailles de 5 km (GBIF) ; les deux morilles n'ont aucune maille avec le nom GBIF utilisé (même cas à vérifier dans les autres régions).
- Pas de sorties de sociétés de mycologie ni de points iNaturalist dans cette région (`SORT_P` vide, `obs` vide) : décision iNaturalist en cours dans un autre fil.
- La partie genevoise de l'emprise est traitée comme le reste (pas de chasse à Genève, non modélisé).
- Fond de carte : 404 mosaïques (87 Mo), tuiles à moins de 2 km d'une forêt au-delà du zoom 12.
- Météo : `nyn/data.json` ajouté au workflow Météo.

## Lot 3 : Broye (`bro/`)
Même chaîne que le lot 2 (`pipeline/vd/run_zone.sh bro` puis `finish_zone.sh bro`). Couche WSL : 85,2 % de la forêt classée ; 21 zones sans chasse (districts francs, réserves d'oiseaux). Mêmes limites que le lot 2 (pas de sorties de sociétés, d'iNaturalist ni de zones de tir). `zones.js` : une région par ligne (le fichier est régénéré par `tools/zones_vaud.py`, qui conserve désormais l'état des régions déjà publiées).

## Lot 4 : Vully et Avenches (`vul/`)
Même chaîne. Couche WSL : 84,3 % de la forêt classée. Région petite (≈ 50 Mo). La région Riviera-Chablais est renommée « Riviera-Chablais et Veveyse (FR) » : ses données contenaient déjà la Veveyse fribourgeoise, qui n'a donc pas besoin d'être régénérée (liste des régions et téléchargement hors ligne).

## Lots 5 et 6 : Chablais alpin (`chb/`) et Pays-d'Enhaut (`pde/`)
Même chaîne que les lots 2 à 4. Couche WSL sur la forêt de l'emprise : 86,7 % (chb) et 84,0 % (pde) des cellules de forêt de 25 m. Deux régions de montagne : une grande partie de l'emprise est hors forêt, et les espèces d'altitude sont moins bien classées par le WSL.

## Bilan (20 nov. 2026)
Tout le canton est couvert par 8 régions (≈ 716 Mo de site : ple 120, lsn 41, gdv 118, nyn 107, bro 103, vul 53, chb 103, pde 72 Mo, plus le reste). Le site approche 3/4 de la limite recommandée de 1 Go pour GitHub Pages : une extension à d'autres cantons demandera de réduire le fond de carte (carte nationale seule, zoom 14 au plus) ou de passer par un hébergement de fichiers statiques.
Reste à faire (hors périmètre de cette extension) : sorties des sociétés de mycologie et zones de tir militaires dans les nouvelles régions ; lignes de bus des arrêts ; vérification des mailles de morilles ; validation du modèle sur les régions alpines.
Génération : scripts `pipeline/vd/` du dépôt privé app-champignons (`run_zone.sh <id>` puis `finish_zone.sh <id> <raster WSL>` dans un clone de ce dépôt).
