# Magichampi

Carte « Canton de Vaud » des forêts favorables aux champignons comestibles (huit régions : Riviera-Chablais et Veveyse (FR), Région lausannoise, Gros-de-Vaud, La Côte/Nyon/Jura, Broye, Vully/Avenches, Chablais alpin, Pays-d'Enhaut/Diablerets).
Une seule page (`index.html`) : la région chargée suit la partie de la carte affichée (dernière position mémorisée ; `?r=<id>` force une région : voir `zones.js`). Limites du canton, des districts et des communes : `limites/*.geojson` (swissBOUNDARIES3D, swisstopo, simplifiées), cases dans Menu › Géographie. Les paramètres propres à chaque région (titre, sorties, seuils, chasse) sont dans `<région>/zone.js`, les données dans `<région>/`. Ouvrir le site, toucher ◎ pour suivre sa position, « Hors ligne » pour la télécharger (une région à la fois : Menu › Météo et outils › Régions hors ligne).

Ne consommez aucun champignon sans le contrôle d'un contrôleur officiel (VAPKO).

Le code de la page est maintenant édité ici (`index.html`, un seul fichier pour les trois régions). `ple/index.html`, `lsn/index.html` et `gdv/index.html` ne sont que des redirections. `tools/fusion_une_page.py` a servi à la fusion (migration unique).

## Vue d'ensemble du canton (zoom éloigné)
Aux zooms 10 et moins, la page charge la zone `vd/` à la place d'une région : les huit régions fusionnées à 250 m (blocs d'environ 170 m, ≈ 4 Mo : grille, relevés SwissFungi réunis, météo à 4 km, fond de carte sans noms et photo aérienne des zooms 8 à 11). La bascule se fait à zoom 10 ou moins (vers `vd`) et à zoom 12 ou plus (vers la région), sans changement au zoom 11 (pas de va-et-vient). Les couches fines (routes, chasse, accès, zones de forêt) n'existent qu'à partir du zoom 12.
Régénérer après une mise à jour des régions : `python3 tools/vue_canton.py` (dépendances : numpy, Pillow). La météo de `vd/data.json` est mise à jour par l'Action « Météo » comme celle des régions.

## Licence, données, sécurité
- **Code** : PolyForm Noncommercial 1.0.0 (`LICENSE`), usage non commercial uniquement. Ce n'est donc pas une licence « open source » au sens de l'OSI, mais le code est lisible et réutilisable à des fins non commerciales. Leaflet reste sous BSD-2 (`LICENSES/`).
- **Données** : sources, licences et points ouverts dans `ATTRIBUTIONS.md`. Aucune donnée brute tierce ne doit être versionnée (`.gitignore`, `python3 tools/verifier_depot_public.py`). Options pour la couche d'essences WSL : `docs/donnees-et-open-source.md`.
- **Avertissement** : la carte estime des probabilités, pas une sécurité. Elle ne remplace ni un contrôleur officiel (VAPKO), ni les règles de cueillette cantonales et communales. Ne consommez jamais un champignon non contrôlé ; en cas d'intoxication, Tox Info Suisse : 145.
