# Magichampi

Carte « Canton de Vaud » des forêts favorables aux champignons comestibles (données Riviera-Chablais, Région lausannoise, Gros-de-Vaud).
Une seule page (`index.html`) : la région chargée suit la partie de la carte affichée (dernière position mémorisée ; `?r=ple`, `?r=lsn` ou `?r=gdv` force une région). Limites du canton, des districts et des communes : `limites/*.geojson` (swissBOUNDARIES3D, swisstopo, simplifiées), cases dans Menu › Géographie. Les paramètres propres à chaque région (titre, sorties, seuils, chasse) sont dans `<région>/zone.js`, les données dans `<région>/`. Ouvrir le site, toucher ◎ pour suivre sa position, « Hors ligne » pour la télécharger.

Ne consommez aucun champignon sans le contrôle d'un contrôleur officiel (VAPKO).

Le code de la page est maintenant édité ici (`index.html`, un seul fichier pour les trois régions). `ple/index.html`, `lsn/index.html` et `gdv/index.html` ne sont que des redirections. `tools/fusion_une_page.py` a servi à la fusion (migration unique).
