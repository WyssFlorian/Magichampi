# Code ouvert, données non publiées : options (20.11.2026)

## Constat (vérifié dans le dépôt)
- Le dépôt est public et GitHub Pages sert ses fichiers tels quels.
- Les tuiles `ple|lsn|gdv/grid/*.json` contiennent une couche **`wsl`** : classe d'essence dominante par cellule de 25 m, dérivée de la carte WSL des essences 10 m (Koch et al. 2024, EnviDat, accès sur demande, usage non commercial à clarifier). C'est une redistribution de fait d'une donnée dérivée, à plein détail.
- Les mêmes tuiles portent d'autres couches dérivées (OFEV/WSL : mélange, hauteur de végétation ; milieux naturels ; swisstopo), plus ouvertes mais soumises à attribution.
- Le raster brut WSL n'est **pas** dans ce dépôt (il est dans le dépôt privé `app-champignons`, dossier `data-wsl-essences/`). L'historique git contient les tuiles avec couche `wsl` depuis le commit 1afd819.
- Les photos `*/obs/*.jpg` sont des photos iNaturalist (licence propre à chaque observateur, parfois CC BY-NC).

## Principe : rien n'est caché si le site le sert
Un site web statique envoie les tuiles au navigateur : toute donnée nécessaire à la carte est téléchargeable par n'importe quel visiteur. On ne peut donc pas à la fois publier la carte librement et garder ses données « non publiques ». On peut seulement : (a) ne pas publier les données brutes ni le code qui les produit, (b) réduire ce que les tuiles contiennent, (c) restreindre l'accès au site.

## Options
| | Ce qui devient public | Risque juridique | Risque technique / coût | Recommandation |
|---|---|---|---|---|
| **A. Code seul public, pipeline et brut privés** (déjà le cas pour le brut) | Code, `index.html`, docs. Les tuiles restent servies par le site. | Le WSL n'est pas résolu : les tuiles dérivées restent une redistribution. | Aucun. | À faire dans tous les cas (fait dans cette PR : `.gitignore`, garde-fou `tools/verifier_depot_public.py`). |
| **B. Retirer la couche `wsl` des tuiles publiées** | Plus aucune essence par cellule. Restent conifères/feuillus et milieux. | Faible : la carte WSL n'est plus redistribuée. | Les espèces à hôte précis perdent le facteur « essence » (validation 0,654 → ≈ 0,639, seuils V6 à recalibrer). `tools/retirer_wsl.py` le fait sans toucher la source (testé : 128 tuiles). | **Recommandée tant que le WSL n'a pas répondu.** |
| **C. Garder la couche, demander l'accord au WSL** | Tout, comme aujourd'hui. | Moyen à fort jusqu'à réponse écrite (brouillon : `docs/mail-wsl.md`). SwissFungi est aussi WSL : même interlocuteur. | Aucun, mais le WSL peut refuser. | À lancer en parallèle de B. |
| **D. Couche `wsl` dégradée** (par ex. seulement résineux/feuillus par maille de 250 m) | Valeur dérivée peu exploitable. | Moindre mais pas nul : reste une donnée dérivée. | Perte de précision, à valider. | Compromis si le WSL accepte seulement une version agrégée. |
| **E. Site privé (Cloudflare Access / dépôt privé avec Pages payant)** | Rien, sauf aux personnes autorisées. | Faible (usage privé), mais n'est plus « ouvert ». | Comptes à gérer ; Pages depuis dépôt privé demande un plan GitHub payant ; sans compte pas de partage. | Seulement si le WSL refuse et que la couche est jugée indispensable. |
| **F. Purger l'historique git** (git filter-repo + force-push) | Retire les anciennes tuiles `wsl` des commits passés. | Nécessaire si on choisit B : sinon les tuiles `wsl` restent téléchargeables dans l'historique. | **Irréversible**, casse les PR/forks ouverts, change tous les identifiants de commits ; les forks et caches déjà faits ne sont pas purgés. | À faire seulement après décision B, une fois les PR en cours fusionnées. |

## Mise en œuvre proposée (B + C + F, dans cet ordre)
1. Fusionner la PR (licence, attributions, garde-fou).
2. Envoyer le mail au WSL (`docs/mail-wsl.md`).
3. Décision de Florian : retirer `wsl` des tuiles publiées maintenant (B) ou attendre la réponse du WSL (C).
4. Si B : `python3 -I tools/retirer_wsl.py . sortie/` puis remplacer `*/grid/`, puis purge d'historique (F) sur accord explicite.
5. Génération côté privé : le dépôt privé `app-champignons` garde la couche `wsl` (calibration, validation) et la version complète du site pour l'usage personnel de Florian.
