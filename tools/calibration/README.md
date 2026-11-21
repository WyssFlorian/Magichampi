# Calibration globale (21.11.2026)
Les observations (iNaturalist/GBIF, coins, coins partagés déchiffrés) n'ont **aucun effet local** sur le score. Elles règlent seulement l'importance des facteurs pour toute la carte.
1. `observations.py` fusionne les sources et retire les doublons (même identifiant, même espèce + position + date).
2. `facteurs.js` (Playwright, une exécution par région) extrait les facteurs effectifs du score.
3. `calibrer.py` ajuste 12 multiplicateurs (1 = actuel) et valide par blocs de 5 km tenus à l'écart. Voir `docs/rapport-methode.md`, section 9.1.
Nécessite `numpy` et `scipy`. Les fichiers de relevés (`valid_obs.json`, `inat-coins.json`, coins partagés) ne sont pas dans ce dépôt.
