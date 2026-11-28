# Sources de données et attributions

Le **code** de ce dépôt est sous PolyForm Noncommercial 1.0.0 (`LICENSE`). Les **données** gardent la licence de leurs auteurs ; la licence du code ne s'y applique pas.

| Donnée | Source | Licence / statut | Où dans le dépôt |
|---|---|---|---|
| Observations de champignons | SwissFungi (WSL) via GBIF | CC BY 4.0, coordonnées en mailles de 5 km | `*/data.json` (agrégé) |
| Essence dominante 10 m | WSL, Koch, Hobi, Morsdorf, Waser 2024, EnviDat 10.16904/envidat.506 | accès sur demande ; **redistribution à clarifier avec le WSL** | couche `wsl` des tuiles `*/grid/` |
| Mélange, hauteur de végétation, bilan hydrique, calcium | OFEV / WSL (IFN, geo.admin.ch) | données ouvertes, citation | tuiles `*/grid/` |
| Milieux naturels de Suisse v1.2 | OFEV / WSL | données ouvertes, citation | tuiles `*/grid/` (couche `hab`) |
| Relief, géologie GeoCover, fonds de carte, limites | © swisstopo (swissALTI3D, swissTLM3D, swissBOUNDARIES3D) | données ouvertes OGD, citation | tuiles, `limites/`, `*/tiles/` |
| Météo | MétéoSuisse | open data, citation | `*/data.json` (`meteo`) |
| Transports | OFT, opentransportdata.swiss | open data | `*/data.json` |
| Leaflet 1.9.4 | Vladimir Agafonkin | BSD-2-Clause (`LICENSES/Leaflet-BSD-2-Clause.txt`) | `leaflet.js` |

## À faire (suivi)
- Couche `wsl` : voir `docs/donnees-et-open-source.md` et `docs/mail-wsl.md`.
