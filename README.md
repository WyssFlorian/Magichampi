# Magichampi

Carte « Canton de Vaud » des forêts favorables aux champignons comestibles (données Riviera-Chablais, Région lausannoise, Gros-de-Vaud).
Une seule page (`index.html`) : la région chargée suit la partie de la carte affichée (dernière position mémorisée ; `?r=ple`, `?r=lsn` ou `?r=gdv` force une région). Limites du canton, des districts et des communes : `limites/*.geojson` (swissBOUNDARIES3D, swisstopo, simplifiées), cases dans Menu › Géographie. Les paramètres propres à chaque région (titre, sorties, seuils, chasse) sont dans `<région>/zone.js`, les données dans `<région>/`. Ouvrir le site, toucher ◎ pour suivre sa position, « Hors ligne » pour la télécharger.

Ne consommez aucun champignon sans le contrôle d'un contrôleur officiel (VAPKO).

Le code de la page est maintenant édité ici (`index.html`, un seul fichier pour les trois régions). `ple/index.html`, `lsn/index.html` et `gdv/index.html` ne sont que des redirections. `tools/fusion_une_page.py` a servi à la fusion (migration unique).

## Licence, données, sécurité
- **Code** : PolyForm Noncommercial 1.0.0 (`LICENSE`), usage non commercial uniquement. Ce n'est donc pas une licence « open source » au sens de l'OSI, mais le code est lisible et réutilisable à des fins non commerciales. Leaflet reste sous BSD-2 (`LICENSES/`).
- **Données** : sources, licences et points ouverts dans `ATTRIBUTIONS.md`. Aucune donnée brute tierce ne doit être versionnée (`.gitignore`, `python3 tools/verifier_depot_public.py`). Options pour la couche d'essences WSL : `docs/donnees-et-open-source.md`.
- **Avertissement** : la carte estime des probabilités, pas une sécurité. Elle ne remplace ni un contrôleur officiel (VAPKO), ni les règles de cueillette cantonales et communales. Ne consommez jamais un champignon non contrôlé ; en cas d'intoxication, Tox Info Suisse : 145.
