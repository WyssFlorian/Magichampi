# Extension de la carte à tout le canton de Vaud

Demande de Florian (20 nov. 2026) : couvrir tout le canton, affichage découpé par région téléchargeable séparément hors ligne, bande de 1 km autour de chaque région pour que les cartes se chevauchent.

## Découpage (`tools/zones_vaud.py` → `zones.js`)
| id | région | statut | emprise nominale (O, S, E, N) |
|---|---|---|---|
| ple | Riviera-Chablais | publiée | 6,74 – 46,35 – 7,06 – 46,62 |
| lsn | Région lausannoise | publiée | 6,45 – 46,45 – 6,75 – 46,63 |
| gdv | Gros-de-Vaud | publiée | 6,26 – 46,53 – 6,70 – 46,86 |
| nyn | La Côte, Nyon, Jura vaudois (Vallée de Joux ouest) | à faire | 6,06 – 46,28 – 6,52 – 46,70 |
| bro | Broye (Moudon, Lucens, Payerne) | à faire | 6,68 – 46,60 – 7,00 – 46,99 |
| vul | Vully et Avenches | à faire | 6,98 – 46,78 – 7,26 – 46,99 |
| chb | Chablais alpin (Bex, Ormonts, Gryon) | à faire | 6,74 – 46,18 – 7,26 – 46,37 |
| pde | Pays-d'Enhaut et Diablerets | à faire | 7,04 – 46,35 – 7,26 – 46,62 |

Reste non couvert : environ 30 km² d'eau du lac de Neuchâtel (aucune forêt).
Les emprises nominales voisines se recouvrent déjà d'environ 1,5 km ; chaque nouvelle région reçoit en plus une bande de 1 km (`bbox` de `zones.js`), soit au moins 2,5 km de recouvrement. Les trois régions publiées gardent leurs emprises (pas de nouvelle génération).
Le chargement suit la vue : on ne change de région que lorsque le centre de la vue sort de l'emprise de la région chargée (hystérésis), donc la bande de 1 km est visible des deux côtés.

## Lot 1 (cette PR) : socle
- `zones.js` : registre des régions (`ok:1` = données publiées dans `<id>/`). Passer `ok` à 1 (`python3 tools/zones_vaud.py nyn`) publie la région dans la page.
- `index.html` : détection de région générique (plus de liste codée en dur), menu « Météo et outils › Régions hors ligne » avec téléchargement et suppression séparés par région (la région affichée garde son gros bouton).
- `sw.js` : le fichier était vide depuis la fusion des PR empilées (PR 45), donc rien n'était servi hors ligne malgré le bouton. Version du 20 nov. rétablie.

## Lots suivants : une région par PR
Chaîne par région : MNT swissALTI3D, forêt et mélange LFI, hauteur de végétation, pentes/TPI, GeoCover (sol), routes, cours d'eau, arrêts TP, parkings, sentiers, réserves, SwissFungi, grille 25 m en tuiles, fond de carte (carte nationale + orthophoto), puis modèle calibré par région, seuils recalculés (`tools/seuils.js`), zones interdites, chasse (calendrier VD), VAPKO.
**Pas de couche d'essences WSL dans les nouvelles régions** tant que Florian n'a pas décidé (PR 51).

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
