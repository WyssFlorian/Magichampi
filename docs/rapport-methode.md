# Magichampi : méthode et calculs, rapport scientifique vérifié contre le code

Version du code décrite : `main` de Magichampi au commit `dcb7f7c` (PR 78 fusionnée, 20 novembre 2026, après les PR 72 à 78), `index.html` (3 628 lignes). Les numéros de ligne (`index.html:1444`) renvoient à cette version. Les scripts de préparation des données sont dans le dépôt privé `app-champignons` (`pipeline/`, branche `main` au commit `eef5b1c`, PR 3 fusionnée).

**Seconde relecture (20 novembre 2026, après les PR 72 à 78).** Chaque ligne de la table de la section 12, chaque constante, chaque chiffre de validation et de couverture a été revérifié contre ce code : la validation a été rejouée sans le bonus iNaturalist (section 10) et les parts de forêts par classe, la couverture par région et les parts affectées par le bonus ont été remesurées. Les numéros de ligne ont été mis à jour (le code a perdu 2 lignes depuis la première version). Les formules et les constantes n'ont pas changé ; trois écarts nouveaux (D16 à D18) et deux précisions (section 4 : un facteur dépasse 1 ; section 4.10 : le bonus n'est plus seulement local) sont signalés. Aucun fichier de l'application n'a été modifié à cette étape ; D16 à D18 ont été corrigés ensuite (section 13.1).

**Règle de rédaction.** Ce rapport ne décrit que ce que le code fait réellement. Chaque formule a été relue dans la fonction correspondante (table de correspondance, section 12). Quand le code et une description existante (aide intégrée à l'application, `docs/provenance-parametres.md`) divergent, c'est le code qui fait foi ici et l'écart est listé en section 13. Aucun fichier de l'application n'a été modifié pour ce rapport.

## 1. Résumé

Magichampi estime, pour chaque cellule de forêt de 25 m du canton de Vaud et pour 52 espèces comestibles, une **aptitude du lieu** : un produit de facteurs écologiques entre 0 et 1, calculé dans le navigateur. Cette aptitude est transformée en **classes relatives** (faible, moyen, élevé, très élevé) par des seuils fixes par espèce et par région, puis, pour la carte « conditions du moment », combinée à un **indice météo** (saison, eau du sol, température du sol, gel).

Ce que le modèle est : un classement relatif des forêts d'une région, utile pour décider où chercher, construit à partir de connaissances d'experts et de quelques paramètres calibrés. Ce qu'il n'est pas : une probabilité de trouver un champignon.

Points à retenir (détail aux sections 9 à 13) :
- L'aptitude classe mieux les relevés précis que le hasard : rang moyen 0,66 (0,5 = hasard), intervalle à 95 % par blocs de 5 km [0,61 ; 0,71], indice de Boyce 0,98 (rejoué le 20 novembre sur `main` actuel, sans le bonus iNaturalist, résultats identiques à ceux du premier rapport). Les trois cartes d'origine se recouvrent : les « 247 relevés » de la documentation sont **247 paires (relevé, carte), soit 185 relevés distincts**. Aucune espèce n'a 30 relevés distincts ; le coprin chevelu en a 26 (14 % de l'échantillon).
- Les poids calibrés (hôte, altitude, SwissFungi) l'ont été **avant** la correction de la couche « part de conifères » (PR 75, 20 novembre à 14 h 24), qui était inversée. Je l'ai mesuré en rejouant la validation : le résultat publié (0,656) est reproduit exactement avec la couche inversée, et vaut 0,663 avec la couche corrigée. Le poids de l'hôte est sans effet mesurable entre 0 et 0,2. Les conclusions tiennent, mais l'explication « double emploi avec le type de forêt » n'est pas démontrée.
- Quinze écarts entre code et descriptions avaient été listés (section 13), trois autres, trouvés à la seconde relecture (D16 à D18, aucun ne touche la validation), ont été corrigés ensuite. Le 20 novembre 2026 (PR « Corriger les écarts »), tous ceux de la première liste qui relevaient d'une erreur ont été corrigés : le type de forêt, connu pour seulement 5 % des forêts de Vully/Avenches et 37 à 43 % de trois autres régions, l'est maintenant pour 66 à 90 % (cause : la carte des milieux n'était lue que pour le canton de Vaud) ; la fiche et l'aide décrivent désormais la carte « conditions du moment » telle qu'elle colore ; les textes périmés et les constantes inutilisées sont retirés. La colonne « État » de la section 13 donne le détail, y compris ce qui est volontairement laissé.

## 2. Données

| Donnée | Source et licence | Résolution | Rôle dans le modèle | Code |
|---|---|---|---|---|
| Relevés de champignons | SwissFungi (WSL) via GBIF, CC BY 4.0 ; coordonnées déjà floutées en mailles de 5 km | maille LV95 5 km | présence connue (×1 / ×0,914 / ×0,83), saison mensuelle, altitude des trapèzes | `pipeline/v1/dl_fungi.py`, `index.html:1469` |
| Essence dominante | WSL, Koch, Hobi, Morsdorf, Waser (2024), EnviDat 10.16904/envidat.506, accès sur demande, précision annoncée ≈ 76 % | 10 m → 25 m | facteur essence pour 33 espèces à hôtes nommés | `tools/wsl_vers_tuiles.py`, `index.html:1580` |
| Part de feuillus (« Waldmischungsgrad »), hauteur de végétation | OFEV / WSL, Inventaire forestier national, données ouvertes | ≈ 10 m → 25 m | facteur hôte (part de conifères), facteur peuplement | `pipeline/vd/grid.py:45-54` |
| Relief | swisstopo swissALTI3D (OGD) | 10 m → 25 m | altitude, pente, exposition, TPI, humidité topographique | `pipeline/vd/grid.py:35-40, 62-70` |
| Bilan hydrique des stations forestières | OFEV / WSL, moyenne d'avril à août 2009-2018 | 250 m | moitié de l'indice d'humidité | `pipeline/vd/grid.py:170-176` |
| Géologie GeoCover 1:25 000 | swisstopo (OGD) | vecteur → 10 m → 25 m | classe de sol « calcium » 1 à 8, humidité supplémentaire | `pipeline/vd/geocover_fn.py` |
| Atlas géochimique des sols (calcium) | OFEV, 1 km | 1 km | repli là où GeoCover manque, **anciennes régions seulement** (voir D10) | `pipeline/v2/layers.py:39` |
| Carte des milieux naturels v1.2 | OFEV / WSL, types TypoCH 6.x | vecteur → 25 m | facteur type de forêt | `pipeline/vd/grid.py:136-156` |
| Météo mesurée | MétéoSuisse, grilles quotidiennes 1 km (précipitations RprelimD, température moyenne TabsD, minimale TminD, ensoleillement relatif SrelD) | 1 km | indice « conditions du moment » | `pipeline/vd/grid.py:71-92`, `alertes/meteo_update.py` |
| Prévisions | MétéoSuisse, prévisions locales (points), interpolées | points | jours à venir | `alertes/meteo_update.py:79-115` |
| Zones bâties, routes, réserves, marais | ARE 2025, swissTLM3D, Pro Natura, OFEV | vecteur | exclusions et zones de forêt (pas de score) | `pipeline/vd/grid.py:98-135, 183-219` |
| Chasse, contrôles VAPKO | calendriers cantonaux VD et FR, liste VAPKO | — | couches d'information, **hors score** | `index.html:2878-3107` |
| Coins de l'utilisateur, points iNaturalist importés | saisie locale ; fichier d'import | point | bonus +50 % autour des coins de l'espèce ; les points iNaturalist publics n'existent que sous forme agrégée (section 7.1) | `index.html:1590-1600` |

Depuis le 20 novembre 2026 une trace **agrégée** des 62 coins iNaturalist du fichier d'import relève aussi le score public (section 7.1) ; les relevés précis iNaturalist/GBIF servent à la validation (section 10), jamais à la fois dans le score et dans la validation. (Texte antérieur : « ne servent qu'à la validation, jamais au score public ».) Leurs licences (CC BY, CC BY-NC) sont conservées dans le projet.

## 3. Prétraitement et grille de 25 m

Référence : `pipeline/vd/grid.py` (cinq régions les plus récentes ; les trois premières ont été produites par `pipeline/v1`, `v2` et `v3`, voir D8 et D9). Grille en Web Mercator (EPSG:3857), cellules de 25 m, tuiles de 256 × 256 cellules.

1. **Forêt.** Une cellule est forestière si la fraction de forêt LFI est ≥ 0,4 (`isf40`). Les couches du modèle sont mises à zéro hors de `valid`, c'est-à-dire hors forêt **et** hors cellules exclues (D8).
2. **Dérivées du relief.** Pente = arctan de la norme du gradient du MNT, avec un pas de 25 m × cos(latitude moyenne), soit des mètres réels ; exposition = azimut de la pente ; TPI = altitude moins la moyenne d'un carré de ≈ 600 m ; « lisière » = distance, à l'intérieur de la forêt (fraction ≥ 0,5), au bord le plus proche, plafonnée à 508 m.
3. **Exclusions** (`fx`, valeurs 1 forêt, 2 à moins de 100 m d'une localité, 3 à moins de 20 m d'une route de classe 1 ou 2, 4 réserve ou marais). Localités : zones bâties de ≥ 2 ha, tampon 15 m puis 85 m (100 m au total). Routes : autoroutes à routes de 4 m, tampon 20 m. Les routes de 3 m et les chemins ne sont pas exclus.
4. **Zones de forêt.** Forêt « cœur » (hors exclusions, hors routes et chemins) découpée en paliers d'altitude de 150 m, composantes connexes ; les composantes de plus de 40 ha sont recoupées en carrés de ≈ 600 m ; les zones de moins de 1 ha sont absorbées par la zone voisine.
5. **Humidité `mi`** (−100 à +100) = 100 × (0,5 · mt + 0,5 · mw) + supplément GeoCover, avec mt = clamp((TWI − 6) / 3, −1, 1) (TWI = ln(aire drainée × taille de cellule / pente), écoulement D8 sur le MNT) et mw = clamp((bilan hydrique + 75) / 75, −1, 1). Supplément GeoCover : marais +50, glissement de terrain +20, tuf +10, dépôts glaciolacustres +15, alluvions −10.
6. **Sol `ca`** (1 à 8, 0 = inconnu) : classement par expert des lithologies GeoCover (calcaire 6 à 7, dolomie 7, marne 5 à 6, grès 4 à 5, roches siliceuses 3 à 4, moraines 4, tuf 8, marais 2, etc.). Dépôts de surface prioritaires sur la roche en place. Ce n'est **pas** une mesure de calcium du sol, c'est une classe ordinale déduite de la roche.
7. **Type de forêt `hab`** (0 à 8) : regroupement des types TypoCH 6.x (6.1 alluviale, 6.2.4 hêtraie acidophile, 6.2.5 hêtraie à sapin, autre 6.2 hêtraie, 6.3 autre feuillue, 6.4 pinède, 6.5 conifères de basse et moyenne altitude, 6.6 conifères d'altitude).
8. **Essence dominante `wsl`** (0 = inconnu, 1 à 15) : pour chaque cellule de 25 m, classe majoritaire des 9 points (3 × 3, décalés de ±8,3 m) du raster 10 m, avec au moins 2 votes valides (`tools/wsl_vers_tuiles.py`).
9. **Part de conifères `conif`** : la couche source est la part de **feuillus** ; elle est convertie en part de conifères (100 − x) au chargement des tuiles (`index.html:3288`, correction PR 75).
10. **Maille SwissFungi `sq`** (carrés de 5 km), **maille météo `midx`** (1 km, index de la grille MétéoSuisse).

Couverture mesurée sur les tuiles publiées (toutes les cellules `fx = 1`, remesurée le 20 novembre 2026 sur `main` au commit `dcb7f7c` ; la première version utilisait un échantillon d'une tuile sur deux, d'où des écarts de 1 à 5 points) :

| Région | Cellules `fx = 1` | Type de forêt connu | Essence WSL connue | Sol connu |
|---|---|---|---|---|
| ple (Riviera-Chablais) | 731 528 | 83,1 % | 90,6 % | 99,9 % (repli atlas) |
| lsn (Lausanne) | 194 511 | 89,2 % | 93,2 % | 99,9 % (repli atlas) |
| gdv (Gros-de-Vaud) | 1 081 181 | 91,9 % | 95,2 % | 100 % (repli atlas) |
| nyn (La Côte, Jura) | 1 272 224 | 92,2 % | 96,2 % | 90,7 % |
| bro (Broye) | 898 695 | 41 % → **66,0 %** | 87,9 % | 95,0 % |
| vul (Vully, Avenches) | 343 551 | 5 % → **87,5 %** | 89,2 % | 99,8 % |
| chb (Chablais alpin) | 955 979 | 43 % → **90,3 %** | 88,0 % | 91,7 % |
| pde (Pays-d'Enhaut) | 698 160 | 37 % → **88,1 %** | 85,4 % | 81,4 % |

La part de conifères (`conif`) est connue pour 100 % des cellules de forêt des huit régions.

(Flèche : avant → après la correction du 20 novembre 2026, `tools/refaire_hab.py`, qui relit la carte des milieux pour tous les cantons touchés par la région : VD + FR + BE pour vul, VD + FR pour bro, VD + VS + BE pour chb, VD + FR + BE pour pde.) Le reste de Broye, déjà mesuré par sondage de 18 000 cellules, correspond à des cellules de forêt (fraction LFI ≥ 0,4) où la carte des milieux ne porte aucun polygone de forêt : petits bois, rideaux d'arbres et haies d'un paysage agricole ; ce n'est pas une erreur d'extraction.

## 4. Aptitude du lieu : modèle statique

Pour une espèce *s* et une cellule *i* (fonction `aptAt`, `index.html:1585`) :

```
A(i,s) = HAB × HÔTE × WSL × ALT × PEUPL × PENTE × HUM × SOL × RÉGION × (1 + OBS)
```

Tous les facteurs sont multiplicatifs et compris entre 0 et 1, **sauf** HUM (de 0,85 à 1,15 pour les espèces qui ont une préférence d'humidité, section 4.7) et OBS (de 0 à 0,5). L'aptitude peut donc dépasser 1 (maximum mesuré 1,15 sans bonus, 1,58 avec ; maximum théorique 1,73) : c'est voulu, un site frais est favorable, et le rang par histogramme couvre désormais 0 à 2 (D17, corrigé). Le produit n'est pas normalisé : l'aptitude absolue n'a de sens que comparée aux autres cellules.

### 4.1 Type de forêt (`habF`, `index.html:1556`)
`HAB = T[s][h]`, où `T` est une table à dire d'expert (52 espèces × 8 types, valeurs de 0,1 à 1). Type inconnu (`h = 0`) : moyenne des 8 valeurs de l'espèce (changement du 17 novembre ; avant, 1). Poids 1.

### 4.2 Hôte : part de conifères (`hostF`, `hostW`, `index.html:1444, 1584`)
Soit *c* la part de conifères (0 à 1 ; inconnue = 0,5) :

| Préférence | Formule |
|---|---|
| `both` | 0,8 + 0,2 · (1 − 2·\|c − 0,5\|) |
| `conif` | 0,2 + 0,8 · c |
| `broad` | 0,2 + 0,8 · (1 − c) |
| `spruce` | 0,05 + 0,95 · min(1, c / 0,6) |
| `any` | 1 |

Si le type de forêt est connu, on prend la racine carrée (« soft »). Le facteur final est `hostF^W_HOST` avec `W_HOST = 0,1` : l'exposant effectif est donc **0,1** (type inconnu) ou **0,05** (type connu).

### 4.3 Essence dominante WSL (`wslF`, `index.html:1563-1583`)
Pour les 33 espèces ayant une liste d'hôtes (`WSL_HOSTS`), avec *k* l'essence de la cellule :
- valeur brute : 1 si *k* est un hôte ; sinon `WSL_SAME = 0,6` si *k* est du même type (conifère ou feuillu) que **le premier hôte listé**, `WSL_OTHER = 0,3` sinon ;
- atténuation par la fiabilité de la classe : `v = 1 − r · (1 − brut)`, avec r = 0,8 (0,6 pour le hêtre et l'épicéa, que la carte surestime) ;
- tolérance de voisinage : si un hôte est présent à moins de 50 m (anneaux de 1 et 2 cellules), le « brut » vaut 0,9 au lieu de 0,6 ou 0,3 ;
- facteur = `v^W`, avec W = **1,6** pour 17 espèces à hôtes étroits (pins, épicéa, sapin : groupe N), **1,2** pour 10 espèces à feuillus précis (groupe B), **0,4** pour les 6 autres (groupe G : cèpe de Bordeaux, girolle, pied-de-mouton, laccaire à deux couleurs, bolet à pied rouge, russule des épicéas) ;
- essence inconnue : moyenne de `v` sur un échantillon (une cellule sur sept) des forêts de la région chargée, élevée à la même puissance.
Pire cas pour un hôte étroit : (1 − 0,8·0,7)^1,6 ≈ 0,27.

### 4.4 Altitude (`altW`, `trap2`, `index.html:1584, 1655`)
Trapèze `[a, b, c, d]` propre à l'espèce : 0 en dessous de a et au-dessus de d, 1 entre b et c, linéaire entre. Plancher 0,03, puis exposant `W_ALT = 0,6` : minimum 0,12. Les quatre valeurs viennent des centiles 1, 10, 90 et 99 des altitudes des relevés SwissFungi de l'espèce, élargis de −100 m et +150 m (`pipeline/v2/score2.py:8-12`), valeurs d'expert pour les espèces ajoutées ensuite.

### 4.5 Peuplement (`standF`, `index.html:1455`)
Avec *h* la hauteur de végétation (m) et *e* la distance à la lisière (m) :
- `mature` : 0,2 si h < 3 ; 1 si h ≥ 15 ; linéaire entre ;
- `edge` : (1 si e ≤ 30 ; 0,45 si e ≥ 150 ; linéaire) × (1 si h < 14, 0,75 sinon) ;
- `any` : 0,4 si h < 2, sinon 1.

### 4.6 Pente (`slopeF`, `index.html:1460`)
1 jusqu'à 25° ; 0,35 à partir de 45° ; linéaire entre. Maintenue dans le score parce que la retirer fait baisser la validation (0,639 → 0,617), mais son effet est en grande partie un **biais d'observation** (peu d'observateurs sur les pentes fortes) ; elle est présentée dans l'application comme facteur d'accès.

### 4.7 Humidité (`moistF`, `index.html:1462`)
Avec M = mi/100 et *w* la préférence (−1 tolère le sec, 0 indifférent, +1 aime le frais) : si w ≠ 0, `1 + 0,15 · w · M` (±15 %, **la seule formule qui peut donner plus de 1**) ; si w = 0, `1 − 0,1 · max(0, −M)` (jusqu'à −10 % en milieu sec).

### 4.8 Sol (`soilF`, `index.html:1465`)
Avec `[p, k] = SOIL[s]` (p = préférence de −1 acidophile à +1 calcicole, k = amplitude) et t = clamp((ca − 4,5) / 3, −1, 1) : `1 − k · clamp(−p · t, 0, 1)`. La pénalité maximale est donc **k · \|p\|** : 0,3 pour p = ±1, mais 0,075 pour p = ±0,5 avec k = 0,15 (D11). Sol inconnu (ca = 0) ou p = 0 : 1.

### 4.9 Présence connue (`regionF`, `index.html:1469`)
Selon la période de relevés choisie (2 dernières années, 5 dernières, toutes) : relevé dans la maille de 5 km de la cellule → 1 ; sinon relevé dans l'une des 8 mailles voisines → 0,914 ; sinon → 0,83. Ces deux valeurs sont 0,925 et 0,85 élevés à la puissance 1,15 (calibrée). Le terme reflète autant l'effort d'observation que la présence réelle.

### 4.10 Bonus d'observations (`obsBonus`, `index.html:1590-1600`)
Pour chaque point de l'espèce, `+0,5 · exp(−d / 250 m)`, nul au-delà de 1 000 m ; maximum retenu sur les points. Facteur `1 + bonus`. Les points sont de deux origines, combinées **par maximum** : les coins de l'utilisateur (locaux, dans le navigateur) et, depuis le 20 novembre 2026, 47 points iNaturalist agrégés publiés dans le code (bloc `PUB_OBS`, `index.html:1593`, section 7.1). Le bonus n'est appliqué que dans `staticFor` (l'affichage) ; le calcul des seuils et la validation passent un bonus nul à `aptAt`.

## 5. Rang, classes et zones

**Seuils par espèce** (`thrClass`, `index.html:1422`). Pour chaque région, on calcule l'aptitude de toutes les forêts (`fx > 0`, une cellule sur deux, bonus nul, relevés de toutes les années) puis les quantiles 60 %, 85 % et 96,25 % (`tools/seuils.js`, `tools/ecrire_seuils.py`, stockés dans `<région>/zone.js` sous `MAP_THR_V6`). Classe : 4 « très élevé » si A ≥ q96,25 ; 3 « élevé » si A ≥ q85 ; 2 « moyen » si A ≥ q60 ; 1 « faible » sinon. Par construction, 3,75 % des forêts sont en très élevé, 15 % en élevé ou mieux, 40 % en moyen ou mieux. Le contrôle sur les 8 régions (cellules `fx > 0`, moyenne des 52 espèces, remesuré le 20 novembre) donne 3,8 à 4,5 % en très élevé, 15,0 à 15,4 % en élevé ou mieux et 40,0 à 40,1 % en moyen ou mieux ; sur les seules cellules affichées par défaut (`fx = 1`), 14,8 à 16,2 % en élevé ou mieux et 39,7 à 44,3 % en moyen ou mieux (écart dû aux cellules exclues, D8). **Par espèce, l'écart est bien plus grand que la moyenne** : sur les cellules affichées, la part en élevé ou mieux sort de 12 à 19 % pour 19 espèces sur 52 dans au moins une région, avec des extrêmes de 2 % (mélanoleuque gris et blanc et coprin chevelu à Vully) à 34,6 % (morille conique à Vully) (D8).

**Rang** (`staticFor`, `index.html:1605`). Percentile de chaque cellule parmi les cellules utilisables, par histogramme à 2¹⁸ classes couvrant l'aptitude de 0 à 2 (ex æquo traités par rang moyen). Depuis la correction de D17, les aptitudes supérieures à 1 ne sont plus confondues.

**Pourcentage affiché** : `aptPct = 100 · A / A_max`, A_max étant le meilleur A de l'espèce dans la région chargée, **bonus d'observations exclu** (D16, corrigé : même échelle que les seuils et la calibration ; une cellule du bonus peut donc afficher 100 %, plafonné). Les pourcentages de seuil affichés sont `100 · q / A_max`.

**Zones de forêt** : la classe d'une zone est celle de son 80ᵉ centile d'aptitude (ses 20 % meilleures cellules) ; l'indice relatif de la zone est son rang cumulé pondéré par la surface (`index.html:1627-1637`).

## 6. Conditions du moment

Mode « conditions du moment » (météo pour la date choisie, mesures puis prévisions).

- **Saison** (`seasonF`, `index.html:1481`) : profil mensuel des relevés SwissFungi de l'espèce, interpolé linéairement entre les mois (position = mois + (jour − 15) / 30,5), divisé par son maximum, puis élevé à 0,7. Décalage d'altitude `seasonShift = clamp((alt − 600) / 250 · 7, −28, 28)` jours (D3). Le poids de la saison dans l'indice est `seasonW = s^(1,6/0,7)`, soit (relevés)^1,6.
- **Eau du sol** (`weatherCell`, `etTurc`, `index.html:1657-1672`) : seau de 60 mm initialisé à 60 % ; chaque jour, + pluie − évapotranspiration de Turc (`0,013 · T/(T+15) · (23,885 · Rs + 50)`, rayonnement estimé par `Rs = Ra · (0,25 + 0,5 · ensoleillement)`) ; moyenne du taux de remplissage du 14ᵉ au 3ᵉ jour avant la date. Correction locale : `+ 0,15 · mi/100`, le tout borné entre 0 et 1 (`soilW2`, `index.html:1659`). Facteur `soilW` (`index.html:1682`) = min(1, (0,15 + 0,85 · clamp((sol − 0,35) / 0,45, 0, 1)) · (1 + 0,3 · nord · (1 − sol))), avec nord = −SOUTH/0,8 (versants nord favorisés quand le sol est sec).
- **Température du sol à 10 cm** : récurrence `ts ← ts + 0,128 · (T_air + 1,77 − ts)` depuis le début de la série ; calée sur la station d'Aigle 2016-2026 (erreur 0,8 °C contre 2,23 °C). Température utilisée : `T = ts − 1,77 + SOUTH · (0,4 + 1,2 · ensoleillement 10 jours) − 0,0055 · (altitude − altitude de la maille)`. Facteur `tempF = max(0,05, trapèze(T))` ; trapèzes de température d'expert par espèce.
- **Gel** : `fd = Σ max(0, −(Tmin + gradient)) / 3` sur les 7 derniers jours ; facteur `frost^fd` (frost entre 0,6 et 1 par espèce, d'expert).
- **Indice** : `W = seasonW × soilW × tempF × frostF`.
- **Classes de la carte** (`nowCls`) : coloré seulement si la classe statique est ≥ 2 ; classe selon `W`, exprimé en % de l'aptitude maximale du lieu : ≥ 0,45 jaune, ≥ 0,6 rose, ≥ 0,75 orange, ≥ 0,9 bleu. L'aptitude ne module donc pas W : elle ne sert que de filtre. **Depuis le 20 novembre 2026** (D1) l'aide et la fiche décrivent exactement ce comportement, et la fiche affiche la classe `nowCls`, celle de la couleur de la carte (l'ancienne fonction `wAdj`, décalage d'un ou deux crans, est supprimée).
- **Prévisions** : points de prévision locaux dans un rayon de 8 km, pondérés par `1/max(d, 500 m)²`, température corrigée de l'altitude (−0,0055 °C/m), pluie non corrigée.

## 7. Agrégations

- **Forte concentration** : chaque espèce affichée rapporte 3 (très élevé), 2 (élevé), 1 (moyen) points. Les seuils sont les maxima de : seuils fixes (2/4/6 points pour un palier, 4/6/8 pour toutes, réduits au prorata des espèces décochées) et quantiles 60/85/96 % des points sur les forêts chargées (`index.html:1768, 1794-1813`).
- **Meilleur lieu** (`findBest`, `index.html:2269`) : score de zone `(classe + qualité) × taille × part de bonne classe`, avec `sizeW(a) = 0,2 + 0,8 · clamp(ln(a/0,5)/ln(40), 0, 1)` (a = surface du massif continu en ha) et un facteur `0,6 + 0,4 · min(1, ha en classe max / 3)`. Ne modifie pas le score.

### 7.1 Bonus iNaturalist du score public et anti-doublons

- **Forme.** 62 coins iNaturalist (observations « research grade », Vaud) → 47 cases par espèce de 0,005° × 0,0075° (≈ 556 m × 574 m), 7 espèces ; 5 coins sans espèce de l'application et 10 observations tombant dans une case déjà occupée sont fusionnés. Chaque case devient un point au centre de la case (bloc `PUB_OBS`, `index.html:1593`, produit par `tools/inat_bonus_public.py`). Aucun point exact, aucune photo, aucun auteur n'est publié.
- **Effet.** Le même bonus que pour les coins de l'utilisateur : `× (1 + 0,5 · exp(−d / 250 m))`, nul au-delà de 1 km, combiné **par maximum** avec les coins de l'utilisateur.
- **Sans fuite.** `aptAt` reçoit un bonus nul dans la validation (`rerun.js`) et dans le calcul des seuils (`tools/seuils.js`) : les classes sont celles du modèle sans le bonus, et les observations iNaturalist de la validation (qui sont les mêmes observations) ne se valident pas elles-mêmes. Rejoué le 20 novembre sur `main` au commit `dcb7f7c` : résultats identiques à ceux d'avant le bonus (ple, lsn, gdv, 247 paires, rang moyen 0,663). Le bonus n'est donc **pas** une amélioration mesurée : il n'est pas validable avec ces données.
- **Portée du bonus** (mesurée sur les cellules affichées `fx = 1`, une sur deux, sept espèces, huit régions). Le bonus touche 0 à 4,2 % des cellules selon l'espèce et la région (4,2 % au plus à Lausanne, 1,6 % au plus ailleurs), et fait gagner au plus 1 point de part « très élevé » (cèpe de Bordeaux à Lausanne, de 5,04 % à 6,00 %) ; la part « élevé ou mieux » ne bouge que de 0,3 point au plus. Il relevait en revanche A_max de 1,15 à 1,58 au plus (chanterelle en tube `tubaeformis` à Riviera-Chablais), ce qui abaissait les pourcentages affichés de la même proportion ; ce défaut (D16) est corrigé : A_max se calcule sans le bonus.
- **Contrôle contre le double compte (à respecter pour tout futur ajout).** Une observation n'entre qu'une fois : (1) clé = identifiant d'observation (iNat/GBIF) ; (2) à défaut, (espèce, position arrondie à 1e-4°, date) ; (3) après agrégation, une case par espèce n'est écrite qu'une fois (`tools/inat_bonus_public.py` imprime le nombre d'entrées fusionnées) ; (4) dans l'application, public et coins de l'utilisateur sont combinés par maximum, jamais additionnés, et l'import d'un fichier de coins refuse un coin de même espèce, même date et même position (±11 m) ; (5) un point qui sert déjà au bonus ne doit jamais non plus servir à la calibration ou à la validation de ce même score ; (6) SwissFungi (mailles de 5 km) peut contenir des observations d'iNaturalist : ne pas ajouter ces relevés une seconde fois au bonus.

## 8. Ce qui n'entre pas dans le score

Chasse (hachures, calendriers VD et FR), contrôles VAPKO, zones de tir, accès aux transports, réserves (exclusion d'affichage avec la case « cueillette responsable »), lignes de niveau, pente forte (hachures à 30°). Les exclusions du point 3 de la section 3 retirent des cellules de l'affichage mais ne changent pas l'aptitude des autres.

## 9. Calibration

Poids globaux (non par espèce) ajustés le 20 novembre 2026 sur les relevés précis, par régression « présence contre fond groupe cible » (softmax conditionnel : la probabilité d'une cellule de présence parmi les cellules de fond, comme dans une maximisation de vraisemblance de type MaxEnt), exposants bornés entre 0 et 3, régularisés vers 1, évalués par validation croisée à 5 plis par blocs de 5 km (`fit.py`, branche `claude/project-thread-8xtobh` d'`app-champignons`). Résultat : hôte 0,2, altitude 0,6, SwissFungi ×1,15 ; type de forêt, peuplement, pente, humidité et sol laissés à 1. Rang hors échantillon contre le fond : 0,590 → 0,647. Le poids de l'hôte a ensuite été ramené de 0,2 à 0,1 à l'arrivée de la carte WSL (W_WSL = 0,4, puis groupes 1,6 / 1,2 / 0,4), choix validé sur les mêmes relevés (0,639 → 0,654 → 0,656).

Ne sont **pas** calibrés : les trapèzes de température, le gel, les tables type de forêt × espèce, les préférences de sol, le décalage de saison (7 jours par 250 m), la pénalité WSL (0,6 / 0,3), la fiabilité par classe WSL (0,8 / 0,6), les seuils des classes météo. Ce sont des valeurs d'expert (tableau complet dans `docs/provenance-parametres.md`).

## 10. Validation

### 10.1 Protocole
- **Présences** : 230 relevés précis (incertitude de position ≤ 100 m) de GBIF, presque tous iNaturalist « research grade », téléchargés le 17 novembre 2026 ; 37 des 52 espèces sont représentées dans des cellules de forêt (38 dans le fichier brut ; les autres, dont la girolle, n'ont aucun relevé précis).
- **Fond** : 5 197 relevés précis de champignons, toutes espèces (« groupe cible »), censés représenter l'effort d'observation.
- **Mesures** (`ev0.js`, `summ.py`, rejoués par `rerun.js` et `summ2.py`) : `pct` = rang de la cellule du relevé parmi toutes les forêts de la carte (0,5 = hasard) ; `pctBg` = rang parmi les cellules du fond (corrige le biais d'accès) ; indice de Boyce continu (fenêtres de 0,2, pas de 0,05, corrélation de Spearman du rapport observé/attendu) ; part des relevés en classe élevée ou plus (15 % attendu au hasard).
- Doublons espèce × cellule retirés.

### 10.2 Résultats, rejoués sur le code actuel (20 novembre 2026)
Rejoué avec `docs/rapport-methode-verif/rerun.js` (même protocole, code et seuils de `main` au commit `dcb7f7c`, deux exécutions le 20 novembre 2026) :

| Jeu | n | pct | pctBg | Boyce | élevé ou mieux |
|---|---|---|---|---|---|
| Total (247 paires) | 247 | **0,663** | 0,660 | 0,98 | 34 % |
| Total, 185 relevés distincts | 185 | 0,664 | 0,669 | — | — |
| ple | 35 | 0,734 | 0,685 | 0,94 | 43 % |
| lsn | 92 | 0,615 | 0,657 | 0,67 | 33 % |
| gdv | 120 | 0,679 | 0,656 | 0,99 | 33 % |
| Palier 1 (stars) | 53 | 0,745 | 0,728 | 0,88 | 43 % |
| Palier 2 | 97 | 0,641 | 0,627 | 0,87 | 31 % |
| Palier 3 | 97 | 0,639 | 0,657 | 0,92 | 32 % |
| Sans le coprin chevelu (relevés distincts) | 159 | 0,683 | 0,690 | — | — |
| Les 8 régions (312 paires, dont 65 hors ple, lsn, gdv) | 312 | 0,666 | 0,647 | — | — |

Intervalle à 95 % par rééchantillonnage de blocs de 5 km (2 000 tirages, `docs/rapport-methode-verif/boot.py`) : pct [0,609 ; 0,713] (247 paires, 59 blocs), [0,606 ; 0,725] (185 distincts, 48 blocs) ; pctBg [0,616 ; 0,704] et [0,620 ; 0,721]. (La première version donnait [0,611 ; 0,716] et [0,607 ; 0,725] : l'écart de ±0,003 vient du tirage aléatoire.)

**Sans bonus iNaturalist.** `rerun.js` appelle `aptAt` avec un bonus nul : les points iNaturalist agrégés (`PUB_OBS`) et les coins de l'utilisateur n'entrent ni dans la validation ni dans le calcul des seuils (`tools/seuils.js`). Les valeurs de ce tableau sont donc celles du modèle sans bonus, et identiques aux valeurs obtenues avant l'ajout du bonus. Le code contient un commentaire inexact (« aptAt les ignore », `index.html:1591`) : c'est l'appelant qui passe un bonus nul.

### 10.3 Effet de la correction de la couche « conifères »
Avec la couche inversée (état d'avant le 20 novembre à 14 h 24), le même script redonne exactement les valeurs de la documentation : 0,656 au total (ple 0,729, lsn 0,603, gdv 0,674), Boyce 0,99. Avec la couche corrigée : 0,663. Puissance de l'hôte, couche corrigée :

| W_HOST | 0 | 0,1 (actuel) | 0,2 | 0,4 |
|---|---|---|---|---|
| pct | 0,662 | 0,663 | 0,660 | 0,655 |

Le poids de l'hôte est donc sans effet mesurable entre 0 et 0,2 : l'information « part de conifères » n'ajoute rien au type de forêt et à l'essence WSL à cette échelle de données. (Les parts « élevé ou mieux » ne sont pas comparables entre ces variantes, les seuils n'étant recalculés que pour W_HOST = 0,1.)

## 11. Limites connues

1. **Biais d'observation.** Les relevés précis sont surtout iNaturalist : ils reflètent où les gens marchent. Le fond groupe cible en corrige une partie, pas la totalité. Environ 80 % de l'effet de la pente est de l'effort d'observation (voir `ponderation/biais-pente-2026-11-20.md` dans le dossier du projet).
2. **Peu de relevés par espèce.** Aucune espèce n'a 30 relevés distincts. Les poids sont globaux ; les paramètres par espèce restent des valeurs d'expert. Les gains attribués à la carte WSL (+0,015 puis +0,002) sont à la limite de la signification : intervalle à 95 % [+0,005 ; +0,025] pour le premier, trop faible pour trancher pour le second.
3. **Échantillon non indépendant.** 247 paires pour 185 relevés distincts, un coprin chevelu sur sept, 48 à 59 blocs de 5 km.
4. **Carte WSL des essences.** Précision annoncée ≈ 76 %, validée seulement sur ses propres données d'entraînement ; le hêtre et l'épicéa y sont surestimés, les autres essences sous-estimées. **Le mélèze n'est pas une classe** : le bolet élégant et le bolet gris des mélèzes n'ont donc aucun facteur d'essence.
5. **Couche des conifères.** C'est la part de feuillus de l'inventaire forestier, convertie en conifères au chargement ; elle indique une part, pas l'essence.
6. **Type de forêt, sol, humidité** : données modélisées (carte des milieux naturels, classes de roche GeoCover déduites par expert, indice d'humidité = moyenne d'un indice de relief et d'un bilan hydrique à 250 m).
7. **Classes relatives.** Une classe est un rang dans les forêts de la région, pas une probabilité ; elles ne sont pas comparables d'une région à l'autre, car les seuils sont propres à chaque région.
8. **Saison.** Décalage d'altitude unique pour toutes les espèces (une hypothèse, non calibrée) ; profil mensuel suisse, pas vaudois.
9. **Météo.** Résolution de 1 km ; prévisions figées au moment de la mise à jour ; modèle de seau simplifié (60 mm fixes, sans réserve utile du sol).
10. **Validation hors échantillon des seuils météo** : aucune. La carte « conditions du moment » n'a pas été validée contre des dates de relevés.
11. **Poids de l'essence calibrés avec la couche inversée** (section 10.3) : à refaire quand le fichier de coins partagés sera disponible.
12. **Seuils calculés sur plus de cellules que celles affichées.** Les seuils portent sur toutes les forêts (`fx > 0`), l'affichage par défaut sur `fx = 1` : en moyenne l'écart est faible, pour certaines espèces il est grand (D8, section 5).
13. **Le bonus d'observations n'est pas validable** (section 7.1) (il n'entre plus dans A_max depuis la correction de D16).

## 12. Table de correspondance « formule → code »

| # | Formule / paramètre | Fichier : ligne ou fonction | Vérifié |
|---|---|---|---|
| 1 | Produit des facteurs A(i,s) | `index.html:1585` `aptAt` | oui |
| 2 | Type de forêt, inconnu = moyenne | `index.html:1556` `habF`, table `HAB` `1546` | oui |
| 3 | Hôte (4 formes + racine carrée) | `index.html:1444` `hostF` | oui |
| 4 | Exposant hôte W_HOST = 0,1 | `index.html:1558, 1584` `hostW` | oui |
| 5 | Essence WSL : valeurs 1 / 0,6 / 0,3, fiabilité 0,8 / 0,6 | `index.html:1563, 1572-1573` | oui |
| 6 | Groupes N 1,6 / B 1,2 / G 0,4 | `index.html:1566-1568, 1574` | oui (17 / 10 / 6 espèces) |
| 7 | Voisinage 50 m = 0,9 | `index.html:1576` `wslNear` | oui |
| 8 | Altitude : trapèze, plancher 0,03, exposant 0,6 | `index.html:1430, 1655, 1584` | oui |
| 9 | Peuplement (mature / edge / any) | `index.html:1455` `standF` | oui |
| 10 | Pente 25° → 45° | `index.html:1460` `slopeF` | oui |
| 11 | Humidité ±15 % / −10 % | `index.html:1462` `moistF` | oui |
| 12 | Sol : 1 − k · clamp(−p·t, 0, 1) | `index.html:1465` `soilF` | oui (D11) |
| 13 | Présence : 1 / 0,914 / 0,83 | `index.html:1469` `regionF` | oui |
| 14 | Bonus coins +0,5 · exp(−d/250) | `index.html:1590-1600` `obsBonus`, `PUB_OBS` `1593` | oui |
| 15 | Seuils q60 / q85 / q96,25 | `tools/seuils.js`, `index.html:1422` `thrClass` | oui (recalculés) |
| 16 | Rang par histogramme | `index.html:1605-1645` `staticFor`, `aptPct` `1644` | oui |
| 17 | Zone : 80ᵉ centile | `index.html:1627-1637` | oui |
| 18 | Saison, exposant 0,7, décalage 7 j / 250 m | `index.html:1480-1488` | oui (D3) |
| 19 | Poids saison s^(1,6/0,7) | `index.html:1681` `seasonW` | oui |
| 20 | Seau 60 mm, Turc | `index.html:1657-1672` | oui |
| 21 | Température du sol k = 0,128, +1,77 °C | `index.html:1669-1671`, `pipeline/v3/fit_tsoil.py` | oui |
| 22 | Température corrigée (exposition, gradient) | `index.html:1683-1699` | oui |
| 23 | Gel : degrés sous 0 °C ÷ 3, 7 jours | `index.html:1687, 1696` | oui |
| 24 | Classes « moment » 0,45 / 0,6 / 0,75 / 0,9 | `index.html:1738-1739` `nowCls` | oui (D1) |
| 25 | Forte concentration (3/2/1, quantiles) | `index.html:1768, 1794-1813` | oui |
| 26 | Meilleur lieu, sizeW | `index.html:2267-2294` | oui |
| 27 | Flou des coins partagés | `index.html:2813` `seBlur` | oui (section 14) |
| 28 | Conversion feuillus → conifères | `index.html:3288` | oui |
| 29 | Exclusions, zones, humidité, sol, type de forêt | `pipeline/vd/grid.py` | oui (régions récentes) |
| 30 | Interpolation des prévisions | `alertes/meteo_update.py:79-115` | oui |
| 31 | Validation (rang, Boyce) | `pipeline/validation/summ.py`, `docs/rapport-methode-verif/` | rejoué (deux fois) |
| 32 | Calibration des poids | `pipeline/validation/etape2/fit.py` (toujours absent de `main` d'`app-champignons`) | lu, non rejoué |
| 33 | Parts de forêts par classe, couverture des couches | `docs/rapport-methode-verif/shares.js` ; mesure de couverture dans le navigateur | rejoué (8 régions) |

## 13. Divergences et bugs trouvés

Gravité : **A** à examiner en priorité, **B** à corriger dans les textes ou le code quand cela vaut la peine, **C** détail.

| # | Gravité | Écart | Preuve |
|---|---|---|---|
| D1 | **A** | La carte « conditions du moment » ne fait pas ce que l'aide décrit. L'aide dit « aptitude × saison × … » et que la météo abaisse ou relève la classe d'un ou deux crans ; la légende dit « % de l'aptitude maximale ». Le code colore par `nowCls` : seuil sur W seul (0,45 / 0,6 / 0,75 / 0,9), l'aptitude servant seulement de filtre (classe ≥ 2). La fiche (popup) affiche à la place une classe obtenue par `wAdj` (décalage de classe selon WT), qui peut différer de la couleur de la carte. | `index.html:1424, 1739-1740, 1929, 1956` |
| D9 | **A** | Type de forêt connu pour 5 % des forêts de Vully/Avenches, 37 à 43 % de Broye, Chablais alpin et Pays-d'Enhaut (84 à 92 % pour les trois anciennes régions et 93 % pour La Côte) ; ailleurs le facteur est neutre (moyenne de l'espèce) et le modèle y est moins discriminant. Cause probable : extraction incomplète de la carte des milieux dans `pipeline/vd/grid.py`. À vérifier avant d'annoncer ces régions comme équivalentes. | mesure sur les tuiles, section 3 |
| D8 | B | Régions nyn, bro, vul, chb, pde : les couches (hauteur, conifères, pente, etc.) des cellules `fx = 2` ou `3` sont à zéro (`np.where(F, …, 0)`), alors qu'elles sont conservées pour ple, lsn, gdv. Si l'on affiche les forêts exclues, leur score est calculé sur des valeurs nulles. Les seuils sont calculés sur toutes les cellules `fx > 0` (4,6 à 14 % de cellules exclues, 33 % pour lsn) : jusqu'à 44,3 % des forêts affichées (Vully ; 43,2 % à Lausanne) sont en « moyen ou mieux » au lieu de 40 %. **L'effet par espèce est plus fort que l'effet moyen** : sur les cellules affichées, la part « élevé ou mieux » va de 2 % (mélanoleuque gris et blanc et coprin chevelu à Vully) à 34,6 % (morille conique à Vully) au lieu de 15 % ; 47 couples (espèce, région) sur 416 sortent de 12 à 19 %. Les espèces de lisière et de milieux ouverts (coprin chevelu, mélanoleuque, coulemelle, lépiote mamelonnée, lépiste sordide, tricholome de la Saint-Georges) sont les plus touchées : leurs meilleures cellules sont près des localités et des routes, exclues de l'affichage. | tuiles ; `pipeline/vd/grid.py:135, 222` ; `tools/seuils.js` ; `shares.js` |
| D7 | B | Les poids et la validation du 20 novembre datent d'avant la correction de la couche conifères (inversée). Les valeurs de la documentation (0,656) sont exactes pour la couche inversée ; avec la couche corrigée, 0,663. L'explication « double emploi hôte / type de forêt » n'est pas démontrée (section 10.3). | section 10.3 |
| D6 | B | « 247 relevés précis » = 247 paires (relevé, carte) pour **185 relevés distincts** (les cartes se recouvrent) ; la documentation et l'aide parlent de 247 relevés. | `rerun.js` : 247 / 185 identifiants |
| D4 | B | Le texte de la fiche (« conifères ×0,1 ; essence dominante WSL ×0,4 ; altitude ×0,6 ») est inexact : l'exposant de l'essence WSL est 1,6, 1,2 ou 0,4 selon l'espèce, et celui de l'hôte vaut 0,05 quand le type de forêt est connu. L'aide « Comment le score est calculé » ne mentionne pas du tout le facteur WSL. | `index.html:1569-1577, 1927` ; aide `index.html:1237-1250` |
| D5 | B | L'aide affiche encore la validation du 15 novembre (51 observations, rang 52 à 54 sur 100) ; l'état actuel est 0,66 (247 paires, 185 relevés). | `index.html` aide, ligne « Validation (15.11.2026) » |
| D10 | B | Les cinq régions récentes n'ont pas de repli sur l'atlas géochimique là où GeoCover manque (sol neutre) : sol connu pour 81,4 % (Pays-d'Enhaut) à 99,8 % (Vully). L'aide annonce le repli. | `pipeline/vd/grid.py:179-182`, aide `index.html:1243` |
| D14 | B | Les scripts de validation de `main` d'`app-champignons` (`ev0.js:19`) échouent avec le code actuel (`aptAt(…, null)` alors que le 4ᵉ argument doit être un tableau ; toujours le cas le 20 novembre) ; les scripts de calibration (`fit.py`, `evf.js`) sont sur une branche non fusionnée ; la validation de la carte WSL n'a aucun script versionné. Rejouable avec `docs/rapport-methode-verif/rerun.js` ajouté ici. | dépôt `app-champignons` |
| D2 | C | Constantes mortes : `AP`, `aClass` (jamais appelée), `SEASON_CAP` (la règle « moins de 30 % de saison, jamais en très élevé » n'est pas codée ; elle est vraie par construction, puisque W ≥ 0,9 exige une saison ≥ 0,955). | `index.html:1419, 1425, 1770` (avant leur suppression) |
| D3 | C | Le décalage de saison est symétrique : en dessous de 600 m, la saison est **retardée** (−8 jours à 300 m, −11 jours à 200 m). L'aide et le commentaire ne mentionnent que le décalage vers le haut. | `index.html:1483` |
| D11 | C | La pénalité de sol maximale est k·\|p\| et non k : 7,5 % (et non 15 %) pour les espèces à préférence ±0,5. | `index.html:1468` ; `docs/provenance-parametres.md` |
| D12 | C | Dans `wslRaw`, « même type » est défini par rapport au **premier hôte** de la liste (cèpe de Bordeaux : le sapin, donc un conifère non hôte compte 0,6 et un feuillu 0,3, alors que l'espèce est « both »). Choix d'expert non documenté. | `index.html:1575` |
| D13 | C | La russule des épicéas (`integra`, hôte épicéa unique) est dans le groupe généraliste (exposant 0,4) alors que les autres espèces à épicéa seul (`varius`, `vinosa`, `mustelina`, `imbricatus`) sont dans le groupe étroit (1,6). | `index.html:1570-1571` |
| D16 | B (corrigé) | **Le bonus d'observations entre dans A_max.** `staticFor` calcule A_max avec le bonus, alors que les seuils des classes (`tools/seuils.js`) sont calculés sans lui. Les pourcentages affichés (`aptPct`, `thrPct`) sont donc rapportés à un maximum relevé jusqu'à ×1,37 (1,15 → 1,58 pour la chanterelle en tube à Riviera-Chablais ; 1,12 → 1,43 pour la trompette-des-morts à Lausanne). Les classes ne sont presque pas touchées (section 7.1), les pourcentages le sont. Le commentaire « aptAt les ignore » (`index.html:1591`) décrit la validation, pas `aptAt`. | `index.html:1591, 1605-1645` ; mesure section 7.1 |
| D17 | C (corrigé) | **L'aptitude peut dépasser 1.** Le facteur d'humidité va de 0,85 à 1,15, et le bonus de 1 à 1,5 : A atteint 1,15 sans bonus et 1,58 avec. Le rang par histogramme (`(a·2¹⁸)` plafonné à 2¹⁸ − 1) met toutes les cellules de A ≥ 1 dans la même classe : elles sont traitées à égalité. Le texte de la section 4 et le commentaire « aptitude entre 0 et 1 » (`index.html:1619`) sont inexacts. | `index.html:1462, 1619` ; mesure A_max sur 8 régions |
| D18 | C (corrigé) | **Texte de `docs/provenance-parametres.md` périmé** : « 30 espèces à hôtes nommés » (ligne 90) ; le code en compte 33 (17 + 10 + 6). | `index.html:1566-1570` |
| D15 | C | L'étiquette de modèle `meta.model` des tuiles de ple, lsn, gdv indique « v2 2026-11-15 » ; elle n'est pas utilisée par le code. Le calcul de `weatherCell` produit aussi une température moyenne `t` jamais lue. | `*/data.json`, `index.html:1666-1673` |

### 13.1 État des correctifs (20 novembre 2026)

| # | État | Ce qui a été fait ou décidé |
|---|---|---|
| D9 | **Corrigé** | La carte des milieux n'était lue que pour le canton de Vaud (`pipeline/vd/grid.py`) : Vully, Broye, Chablais alpin et Pays-d'Enhaut touchent FR, VS ou BE. Le script lit désormais tous les cantons ; les tuiles des 4 régions sont recalculées (`tools/refaire_hab.py`), seuils V6 recalculés. Type de forêt connu : 5 → 88 %, 41 → 66 %, 43 → 90 %, 37 → 88 %. Validation sur les 12 relevés précis de ces régions : 0,664 → 0,666 (312 paires sur les 7 régions qui contiennent des relevés ; rien ne bouge pour ple, lsn, gdv). |
| D1 | **Corrigé (texte et fiche, pas la carte)** | La couleur de la carte et sa légende (« % de l'aptitude maximale ») étaient déjà d'accord ; l'aide et la fiche décrivaient autre chose. On a aligné l'aide et la fiche sur la carte : la fiche donne la classe de la couleur de la carte et le % de l'aptitude maximale ; `wAdj`, `wPen` n'est plus utilisée que pour le libellé « météo favorable… ». |
| D4, D5 | **Corrigé** | Textes de la fiche et de l'aide : exposants réels (hôte ×0,05 / ×0,1, WSL ×1,6 / ×1,2 / ×0,4), validation du 20 novembre (247 paires, 185 relevés). |
| D6 | **Corrigé** | « 247 paires pour 185 relevés distincts » dans l'aide et la fiche. |
| D10 | **Texte corrigé** | L'aide dit que le repli sur l'atlas géochimique n'existe que dans les trois premières régions ; dans les cinq autres, sol neutre. Ajouter le repli demande de relancer la génération de ces régions : non fait. |
| D2 | **Corrigé** | `AP`, `aClass`, `SEASON_CAP` supprimés. |
| D3 | **Corrigé (texte)** | L'aide mentionne le retard de saison en dessous de 600 m. |
| D11, D12 | **Documenté** | Voir `docs/provenance-parametres.md` ; aucun changement de calcul. |
| D13 | **Laissé volontairement** | Russula integra reste « généraliste » : elle accompagne aussi les pins, et un seul relevé précis la concerne (changer son groupe obligerait à recalculer les seuils des 8 régions sans pouvoir le valider). |
| D15 | **Corrigé en partie** | La température moyenne `t` inutilisée est retirée de `weatherCell` (vérifié : absente de `main`) ; l'étiquette `meta.model` de ple, lsn, gdv reste « v2 2026-11-15 » (sans effet). |
| D16 | **Corrigé** | `staticFor` calcule A_max sur `A/(1+bonus)` : les pourcentages et seuils affichés sont rapportés au maximum sans bonus, comme les seuils de classes. Mesuré sur Riviera-Chablais : A_max du cèpe de Bordeaux 1,431 → 1,000 (seuils affichés 54/66/69 % → 77/95/99 %) ; chanterelle, trompette, cibarius inchangés dans ce relevé (leur bonus ne touche pas le maximum). Effectifs par classe identiques. Aucune tuile modifiée : les régions hors ligne n'ont pas besoin d'être retéléchargées. |
| D17 | **Corrigé (plafond non retenu)** | Le dépassement de 1 est voulu (humidité jusqu'à 1,15). On n'a pas plafonné A (cela aurait confondu des sites que l'on veut distinguer) : l'histogramme de rang couvre maintenant 0 à 2 au lieu de 0 à 1 (résolution 2¹⁷ par unité). Classes et seuils inchangés (effectifs par classe identiques avant/après sur 4 espèces) ; seul le rang P des cellules d'aptitude supérieure à 1 change. |
| D18 | **Corrigé** | `docs/provenance-parametres.md` : 33 espèces à hôtes nommés (17 N, 10 B, 6 G). |
**Validation avant/après D16 à D18 : identique par construction.** `rerun.js` appelle `aptAt` avec un bonus nul et n'utilise ni A_max ni l'histogramme de rang ; ces correctifs ne touchent pas `aptAt`. Les chiffres des sections 10.2 et 10.3 restent valables.

| D8 | **Non traité, aggravé par la mesure par espèce** | Mettre les couches des forêts exclues (`fx` 2 et 3) au lieu de zéro demande de régénérer 5 régions ; l'effet (jusqu'à 44,5 % des forêts affichées en « moyen ou mieux » au lieu de 40 %) est signalé en section 5. |
| D7 | **Expliqué (ouvert)** | Section 10.3 ; les poids restent ceux calibrés avec la couche inversée. |
| D14 | **Contourné** | `docs/rapport-methode-verif/rerun.js` rejoue la validation sur les huit régions ; `ev0.js` de `app-champignons` reste cassé (non modifié) et `fit.py` n'est toujours pas sur `main`. |

**Revérifié le 20 novembre 2026 (seconde relecture), sans écart nouveau** : les corrections des PR 77 et 78 sont bien dans `main` (textes de la fiche et de l'aide, constantes `AP`, `aClass`, `SEASON_CAP` supprimées, `weatherCell` sans `t`, `PUB_OBS` de 47 points pour 7 espèces, anti-doublon d'import `(espèce, date, position)`, hab des quatre régions) ; les 52 espèces, 17 / 10 / 6 espèces des groupes WSL N / B / G (33 espèces à hôtes nommés, 19 sans), les constantes de la section 4 et 6, 7 (W_HOST, W_ALT, W_WSL, WSL_SAME, WSL_OTHER, WSL_NEAR, WSL_REL, OB_B, OB_L, OB_MAX, MULTI_Q, NOW_T, WT, SEASON_MIN, BEST_A0, BEST_A1) relues dans le navigateur ; seuils présents et strictement croissants pour les 52 espèces ; facteur gel de 0,6 à 1, tables de type de forêt de 0,1 à 1 ; pire cas d'hôte étroit 0,269.

Vérifié sans écart (première relecture) : paramètres du tableau `docs/provenance-parametres.md` (altitude, température, gel, sol, hôte pour les 52 espèces, comparés au code) ; seuils V6 présents et croissants pour les 52 espèces des 8 régions ; correspondance des codes de type de forêt entre le script et `HAB_LAB` ; indices des essences WSL entre `WSL_HOSTS`, `WSL_NAMES` et `WSL_REL` ; 0,914 et 0,83 = 0,925 et 0,85 à la puissance 1,15 ; surfaces de `sizeW` annoncées dans l'aide (0,7 pour 5 ha).

## 14. Éthique, confidentialité, sécurité

- **Cueillette responsable.** Option qui grise les réserves naturelles, les marais d'importance nationale et la zone centrale du Parc du Jorat (OParcs art. 23), signale les milieux à ménager (amphibiens, zones alluviales, réserves forestières) et affiche une bannière en dehors de 7 h à 20 h (`RULES`, `index.html:1507`). Les règles communales ou cantonales ne sont pas modélisées au-delà du calendrier de chasse.
- **Sécurité.** Chaque fiche liste les sosies toxiques ; l'application ne remplace pas un contrôle VAPKO ; Tox Info Suisse 145 est affiché. Un classement « élevé » n'est pas une garantie de présence ni de comestibilité.
- **Coins privés.** Stockés localement (navigateur) ; leur sauvegarde et leur partage sont volontaires.
- **Envoi chiffré (consentement).** Le navigateur chiffre les coins avec la clé publique de l'auteur (ECDH P-256 éphémère, HKDF-SHA256, AES-256-GCM) ; un Worker Cloudflare les range tels quels dans un dépôt privé. Envoyé : espèce, latitude et longitude, mois, précision. Jamais : nom, photo, identité. Par défaut, la position est **floutée** à la case de 0,005° × 0,0075° (≈ 556 m × 574 m aux latitudes vaudoises), ramenée au centre de la case (`seBlur`, `index.html:2813`) ; ce n'est pas un flou aléatoire. La case d'accord n'est pas pré-cochée ; suppression possible par code. Le code est actif dans `main` (`SHARE_CFG` renseigné, ce que `docs/partage-chiffre.md` ne dit plus : il parle d'un code « désactivé »).
- **Données tierces.** Aucune donnée brute tierce n'est versionnée dans le dépôt public ; les observations iNaturalist (CC BY, CC BY-NC) ont été retirées du site le 20 novembre 2026 et ne servent que localement à l'import. La redistribution de la couche WSL est à clarifier avec le WSL (`docs/mail-wsl.md`). Le code est sous licence PolyForm Noncommercial 1.0.0.

## 15. Reproduire les vérifications de ce rapport

Dans `docs/rapport-methode-verif/` (Playwright, Chromium ; chaque script sert les fichiers de `main` par interception, sans serveur local) :
- `rerun.js` : rejoue la validation (sections 10.2 et 10.3) ; argument `inv` pour la couche conifères inversée, `host:<valeur>` pour changer W_HOST.
- `shares.js` : parts de forêts par classe, cellules affichées contre toutes les cellules (section 5).
- `boot.py` : intervalles de confiance par blocs de 5 km, relevés distincts, sans le coprin (section 10.2).
- `summ2.py` : pct, pctBg, Boyce et part en classe élevée à partir des sorties de `rerun.js`.
- `resultats.json` : résultats agrégés (aucune donnée individuelle).
Le fichier des relevés précis (`pipeline/validation/valid_obs.json`) reste dans le dépôt privé `app-champignons`.

## 16. Références (existence vérifiée, texte intégral non lu pour la plupart)

Koch, Hobi, Morsdorf, Waser (2024) : carte 10 m des essences, EnviDat, doi 10.16904/envidat.506. Boyce, Vernier, Nielsen, Schmiegelow (2002) : évaluation de modèles de sélection d'habitat (indice de Boyce) ; Hirzel et al. (2006) : Boyce continu. Phillips, Anderson, Schapire (2006) et Phillips, Dudík (2008) : modélisation MaxEnt, fond « groupe cible » (target-group background). Pistes de lecture pour le décalage de saison en altitude et la fructification en Suisse : voir `docs/provenance-parametres.md` (références non encore confirmées).
