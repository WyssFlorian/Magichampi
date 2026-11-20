#!/bin/bash
# Ajoute la couche WSL (essence dominante) à une région du pipeline puis recalcule ses seuils de classes.
# À lancer APRÈS la génération des tuiles <zone>/grid/ et de <zone>/zone.js (data.json avec meta.grid), AVANT la publication de la région.
# usage : bash tools/ajouter_wsl_region.sh <zone> <raster WSL .tif>      (depuis la racine du dépôt ; nécessite rasterio, pyproj, playwright)
# Le raster (accès sur demande au WSL) se reconstruit depuis le dépôt privé app-champignons : voir docs/extension-vaud.md.
set -e
Z=$1; TIF=$2; [ -n "$Z" ] && [ -f "$TIF" ] || { echo "usage : $0 <zone> <raster.tif>"; exit 1; }
R=$(pwd); T=$(mktemp)
python3 -I tools/wsl_vers_tuiles.py "$TIF" "$R" "$Z"
node tools/seuils.js "$R" "$Z" > "$T"
python3 tools/ecrire_seuils.py "$Z" "$T"
rm -f "$T"; echo "région $Z : couche wsl + seuils V6 prêts"
