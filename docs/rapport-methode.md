# Magichampi : méthode et calculs, rapport scientifique vérifié contre le code

Version du code décrite : `main` de Magichampi au commit `3143ba4` (PR 75 fusionnée, 20 novembre 2026), `index.html` (3 630 lignes). Les numéros de ligne (`index.html:1447`) renvoient à cette version. Les scripts de préparation des données sont dans le dépôt privé `app-champignons` (`pipeline/`, branche `main`).

**Règle de rédaction.** Ce rapport ne décrit que ce que le code fait réellement. Chaque formule a été relue dans la fonction correspondante (table de correspondance, section 12). Quand le code et une description existante (aide intégrée à l'application, `docs/provenance-parametres.md`) divergent, c'est le code qui fait foi ici et l'écart est listé en section 13. Aucun fichier de l'application n'a été modifié pour ce rapport.

## 1. Résumé

Magichampi estime, pour chaque cellule de forêt de 25 m du canton de Vaud et pour 52 espèces comestibles, une **aptitude du lieu** : un produit de facteurs écologiques entre 0 et 1, calculé dans le navigateur. Cette aptitude est transformée en **classes relatives** (faible, moyen, élevé, très élevé) par des seuils fixes par espèce et par région, puis, pour la carte « conditions du moment », combinée à un **indice météo** (saison, eau du sol, température du sol, gel).

Ce que le modèle est : un classement relatif des forêts d'une région, utile pour décider où chercher, construit à partir de connaissances d'experts et de quelques paramètres calibrés. Ce qu'il n'est pas : une probabilité de trouver un champignon.

Points à retenir (détail aux sections 9 à 13) :
- L'aptitude classe mieux les relevés précis que le hasard : rang moyen 0,66 (0,5 = hasard), intervalle à 95 % par blocs de 5 km [0,61 ; 0,72], indice de Boyce 0,98. Les trois cartes d'origine se recouvrent : les « 247 relevés » de la documentation sont **247 paires (relevé, carte), soit 185 relevés distincts**. Aucune espèce n'a 30 relevés distincts ; le coprin chevelu en a 26 (14 % de l'échantillon).
- Les poids calibrés (hôte, altitude, SwissFungi) l'ont été **avant** la correction de la couche « part de conifères » (PR 75, 20 novembre à 14 h 24), qui était inversée. Je l'ai mesuré en rejouant la validation : le résultat publié (0,656) est reproduit exactement avec la couche inversée, et vaut 0,663 avec la couche corrigée. Le poids de l'hôte est sans effet mesurable entre 0 et 0,2. Les conclusions tiennent, mais l'explication « double emploi avec le type de forêt » n'est pas démontrée.
- Quinze écarts entre code et descriptions avaient été listés (section 13). Le 20 novembre 2026 (PR « Corriger les écarts »), tous ceux qui relevaient d'une erreur ont été corrigés : le type de forêt, connu pour seulement 5 % des forêts de Vully/Avenches et 37 à 43 % de trois autres régions, l'est maintenant pour 66 à 90 % (cause : la carte des milieux n'était lue que pour le canton de Vaud) ; la fiche et l'aide décrivent désormais la carte « conditions du moment » telle qu'elle colore ; les textes périmés et les constantes inutilisées sont retirés. La colonne « État » de la section 13 donne le détail, y compris ce qui est volontairement laissé.

## 2. Données

| Donnée | Source et licence | Résolution | Rôle dans le modèle | Code |
|---|---|---|---|---|
| Relevés de champignons | SwissFungi (WSL) via GBIF, CC BY 4.0 ; coordonnées déjà floutées en mailles de 5 km | maille LV95 5 km | présence connue (×1 / ×0,914 / ×0,83), saison mensuelle, altitude des trapèzes | `pipeline/v1/dl_fungi.py`, `index.html:1472` |
| Essence dominante | WSL, Koch, Hobi, Morsdorf, Waser (2024), EnviDat 10.16904/envidat.506, accès sur demande, précision annoncée ≈ 76 % | 10 m → 25 m | facteur essence pour 33 espèces à hôtes nommés | `tools/wsl_vers_tuiles.py`, `index.html:1583` |
| Part de feuillus (« Waldmischungsgrad »), hauteur de végétation | OFEV / WSL, Inventaire forestier national, données ouvertes | ≈ 10 m → 25 m | facteur hôte (part de conifères), facteur peuplement | `pipeline/vd/grid.py:41-61` |
| Relief | swisstopo swissALTI3D (OGD) | 10 m → 25 m | altitude, pente, exposition, TPI, humidité topographique | `pipeline/vd/grid.py:34-40, 62-70` |
| Bilan hydrique des stations forestières | OFEV / WSL, moyenne d'avril à août 2009-2018 | 250 m | moitié de l'indice d'humidité | `pipeline/vd/grid.py:163-171` |
| Géologie GeoCover 1:25 000 | swisstopo (OGD) | vecteur → 10 m → 25 m | classe de sol « calcium » 1 à 8, humidité supplémentaire | `pipeline/vd/geocover_fn.py` |
| Atlas géochimique des sols (calcium) | OFEV, 1 km | 1 km | repli là où GeoCover manque, **anciennes régions seulement** (voir D10) | `pipeline/v2/layers.py:39` |
| Carte des milieux naturels v1.2 | OFEV / WSL, types TypoCH 6.x | vecteur → 25 m | facteur type de forêt | `pipeline/vd/grid.py:136-149` |
| Météo mesurée | MétéoSuisse, grilles quotidiennes 1 km (précipitations RprelimD, température moyenne TabsD, minimale TminD, ensoleillement relatif SrelD) | 1 km | indice « conditions du moment » | `pipeline/vd/grid.py:71-92`, `alertes/meteo_update.py` |
| Prévisions | MétéoSuisse, prévisions locales (points), interpolées | points | jours à venir | `alertes/meteo_update.py:91-140` |
| Zones bâties, routes, réserves, marais | ARE 2025, swissTLM3D, Pro Natura, OFEV | vecteur | exclusions et zones de forêt (pas de score) | `pipeline/vd/grid.py:98-135, 176-212` |
| Chasse, contrôles VAPKO | calendriers cantonaux VD et FR, liste VAPKO | — | couches d'information, **hors score** | `index.html:2880-3105` |
| Coins de l'utilisateur, points iNaturalist importés | saisie locale ; fichier d'import | point | bonus +50 % autour des coins de l'espèce, **invisible du public** | `index.html:1594` |

Les relevés précis iNaturalist ne servent qu'à la validation (section 10), jamais au score public. Leurs licences (CC BY, CC BY-NC) sont conservées dans le projet.

## 3. Prétraitement et grille de 25 m

Référence : `pipeline/vd/grid.py` (cinq régions les plus récentes ; les trois premières ont été produites par `pipeline/v1`, `v2` et `v3`, voir D8 et D9). Grille en Web Mercator (EPSG:3857), cellules de 25 m, tuiles de 256 × 256 cellules.

1. **Forêt.** Une cellule est forestière si la fraction de forêt LFI est ≥ 0,4 (`isf40`). Les couches du modèle sont mises à zéro hors de `valid`, c'est-à-dire hors forêt **et** hors cellules exclues (D8).
2. **Dérivées du relief.** Pente = arctan de la norme du gradient du MNT (pas en mètres réels, corrigé de cos(latitude)) ; exposition = azimut de la pente ; TPI = altitude moins la moyenne d'un carré de ≈ 600 m ; « lisière » = distance, à l'intérieur de la forêt (fraction ≥ 0,5), au bord le plus proche, plafonnée à 508 m.
3. **Exclusions** (`fx`, valeurs 1 forêt, 2 à moins de 100 m d'une localité, 3 à moins de 20 m d'une route de classe 1 ou 2, 4 réserve ou marais). Localités : zones bâties de ≥ 2 ha, tampon 15 m puis 85 m (100 m au total). Routes : autoroutes à routes de 4 m, tampon 20 m. Les routes de 3 m et les chemins ne sont pas exclus.
4. **Zones de forêt.** Forêt « cœur » (hors exclusions, hors routes et chemins) découpée en paliers d'altitude de 150 m, composantes connexes ; les composantes de plus de 40 ha sont recoupées en carrés de ≈ 600 m ; les zones de moins de 1 ha sont absorbées par la zone voisine.
5. **Humidité `mi`** (−100 à +100) = 100 × (0,5 · mt + 0,5 · mw) + supplément GeoCover, avec mt = clamp((TWI − 6) / 3, −1, 1) (TWI = ln(aire drainée × taille de cellule / pente), écoulement D8 sur le MNT) et mw = clamp((bilan hydrique + 75) / 75, −1, 1). Supplément GeoCover : marais +50, glissement de terrain +20, tuf +10, dépôts glaciolacustres +15, alluvions −10.
6. **Sol `ca`** (1 à 8, 0 = inconnu) : classement par expert des lithologies GeoCover (calcaire 6 à 7, dolomie 7, marne 5 à 6, grès 4 à 5, roches siliceuses 3 à 4, moraines 4, tuf 8, marais 2, etc.). Dépôts de surface prioritaires sur la roche en place. Ce n'est **pas** une mesure de calcium du sol, c'est une classe ordinale déduite de la roche.
7. **Type de forêt `hab`** (0 à 8) : regroupement des types TypoCH 6.x (6.1 alluviale, 6.2.4 hêtraie acidophile, 6.2.5 hêtraie à sapin, autre 6.2 hêtraie, 6.3 autre feuillue, 6.4 pinède, 6.5 conifères de basse et moyenne altitude, 6.6 conifères d'altitude).
8. **Essence dominante `wsl`** (0 = inconnu, 1 à 15) : pour chaque cellule de 25 m, classe majoritaire des 9 points (3 × 3, décalés de ±8,3 m) du raster 10 m, avec au moins 2 votes valides (`tools/wsl_vers_tuiles.py`).
9. **Part de conifères `conif`** : la couche source est la part de **feuillus** ; elle est convertie en part de conifères (100 − x) au chargement des tuiles (`index.html:3290`, correction PR 75).
10. **Maille SwissFungi `sq`** (carrés de 5 km), **maille météo `midx`** (1 km, index de la grille MétéoSuisse).

Couverture mesurée sur les tuiles publiées (cellules `fx = 1`, échantillon d'une tuile sur deux) :

| Région | Type de forêt connu | Essence WSL connue | Sol connu |
|---|---|---|---|
| ple, lsn, gdv (anciennes) | 84 à 92 % | 90 à 95 % | 100 % (repli atlas) |
| nyn (La Côte, Jura) | 93 % | 96 % | 89 % |
| bro (Broye) | 41 % → **66 %** | 88 % | 94 % |
| vul (Vully, Avenches) | 5 % → **88 %** | 88 % | 99,7 % |
| chb (Chablais alpin) | 43 % → **90 %** | 89 % | 96 % |
| pde (Pays-d'Enhaut) | 37 % → **88 %** | 85 % | 81 % |

(Flèche : avant → après la correction du 20 novembre 2026, `tools/refaire_hab.py`, qui relit la carte des milieux pour tous les cantons touchés par la région : VD + FR + BE pour vul, VD + FR pour bro, VD + VS + BE pour chb, VD + FR + BE pour pde.) Le reste de Broye, déjà mesuré par sondage de 18 000 cellules, correspond à des cellules de forêt (fraction LFI ≥ 0,4) où la carte des milieux ne porte aucun polygone de forêt : petits bois, rideaux d'arbres et haies d'un paysage agricole ; ce n'est pas une erreur d'extraction.

## 4. Aptitude du lieu : modèle statique

Pour une espèce *s* et une cellule *i* (fonction `aptAt`, `index.html:1588`) :

```
A(i,s) = HAB × HÔTE × WSL × ALT × PEUPL × PENTE × HUM × SOL × RÉGION × (1 + OBS)
```

Tous les facteurs sont multiplicatifs et compris entre 0 et 1 (sauf OBS, de 0 à 0,5). Le produit est mis à l'échelle de la cellule, pas normalisé : l'aptitude absolue n'a de sens que comparée aux autres cellules.

### 4.1 Type de forêt (`habF`, `index.html:1559`)
`HAB = T[s][h]`, où `T` est une table à dire d'expert (52 espèces × 8 types, valeurs de 0,1 à 1). Type inconnu (`h = 0`) : moyenne des 8 valeurs de l'espèce (changement du 17 novembre ; avant, 1). Poids 1.

### 4.2 Hôte : part de conifères (`hostF`, `hostW`, `index.html:1447, 1587`)
Soit *c* la part de conifères (0 à 1 ; inconnue = 0,5) :

| Préférence | Formule |
|---|---|
| `both` | 0,8 + 0,2 · (1 − 2·\|c − 0,5\|) |
| `conif` | 0,2 + 0,8 · c |
| `broad` | 0,2 + 0,8 · (1 − c) |
| `spruce` | 0,05 + 0,95 · min(1, c / 0,6) |
| `any` | 1 |

Si le type de forêt est connu, on prend la racine carrée (« soft »). Le facteur final est `hostF^W_HOST` avec `W_HOST = 0,1` : l'exposant effectif est donc **0,1** (type inconnu) ou **0,05** (type connu).

### 4.3 Essence dominante WSL (`wslF`, `index.html:1566-1586`)
Pour les 33 espèces ayant une liste d'hôtes (`WSL_HOSTS`), avec *k* l'essence de la cellule :
- valeur brute : 1 si *k* est un hôte ; sinon `WSL_SAME = 0,6` si *k* est du même type (conifère ou feuillu) que **le premier hôte listé**, `WSL_OTHER = 0,3` sinon ;
- atténuation par la fiabilité de la classe : `v = 1 − r · (1 − brut)`, avec r = 0,8 (0,6 pour le hêtre et l'épicéa, que la carte surestime) ;
- tolérance de voisinage : si un hôte est présent à moins de 50 m (anneaux de 1 et 2 cellules), le « brut » vaut 0,9 au lieu de 0,6 ou 0,3 ;
- facteur = `v^W`, avec W = **1,6** pour 17 espèces à hôtes étroits (pins, épicéa, sapin : groupe N), **1,2** pour 10 espèces à feuillus précis (groupe B), **0,4** pour les 6 autres (groupe G : cèpe de Bordeaux, girolle, pied-de-mouton, laccaire à deux couleurs, bolet à pied rouge, russule des épicéas) ;
- essence inconnue : moyenne de `v` sur un échantillon (une cellule sur sept) des forêts de la région chargée, élevée à la même puissance.
Pire cas pour un hôte étroit : (1 − 0,8·0,7)^1,6 ≈ 0,27.

### 4.4 Altitude (`altW`, `trap2`, `index.html:1587, 1655`)
Trapèze `[a, b, c, d]` propre à l'espèce : 0 en dessous de a et au-dessus de d, 1 entre b et c, linéaire entre. Plancher 0,03, puis exposant `W_ALT = 0,6` : minimum 0,12. Les quatre valeurs viennent des centiles 1, 10, 90 et 99 des altitudes des relevés SwissFungi de l'espèce, élargis de −100 m et +150 m (`pipeline/v2/score2.py:8-12`), valeurs d'expert pour les espèces ajoutées ensuite.

### 4.5 Peuplement (`standF`, `index.html:1458`)
Avec *h* la hauteur de végétation (m) et *e* la distance à la lisière (m) :
- `mature` : 0,2 si h < 3 ; 1 si h ≥ 15 ; linéaire entre ;
- `edge` : (1 si e ≤ 30 ; 0,45 si e ≥ 150 ; linéaire) × (1 si h < 14, 0,75 sinon) ;
- `any` : 0,4 si h < 2, sinon 1.

### 4.6 Pente (`slopeF`, `index.html:1463`)
1 jusqu'à 25° ; 0,35 à partir de 45° ; linéaire entre. Maintenue dans le score parce que la retirer fait baisser la validation (0,639 → 0,617), mais son effet est en grande partie un **biais d'observation** (peu d'observateurs sur les pentes fortes) ; elle est présentée dans l'application comme facteur d'accès.

### 4.7 Humidité (`moistF`, `index.html:1465`)
Avec M = mi/100 et *w* la préférence (−1 tolère le sec, 0 indifférent, +1 aime le frais) : si w ≠ 0, `1 + 0,15 · w · M` (±15 %) ; si w = 0, `1 − 0,1 · max(0, −M)` (jusqu'à −10 % en milieu sec).

### 4.8 Sol (`soilF`, `index.html:1467-1468`)
Avec `[p, k] = SOIL[s]` (p = préférence de −1 acidophile à +1 calcicole, k = amplitude) et t = clamp((ca − 4,5) / 3, −1, 1) : `1 − k · clamp(−p · t, 0, 1)`. La pénalité maximale est donc **k · \|p\|** : 0,3 pour p = ±1, mais 0,075 pour p = ±0,5 avec k = 0,15 (D11). Sol inconnu (ca = 0) ou p = 0 : 1.

### 4.9 Présence connue (`regionF`, `index.html:1472`)
Selon la période de relevés choisie (2 dernières années, 5 dernières, toutes) : relevé dans la maille de 5 km de la cellule → 1 ; sinon relevé dans l'une des 8 mailles voisines → 0,914 ; sinon → 0,83. Ces deux valeurs sont 0,925 et 0,85 élevés à la puissance 1,15 (calibrée). Le terme reflète autant l'effort d'observation que la présence réelle.

### 4.10 Bonus de coins (`obsBonus`, `index.html:1594`)
Pour chaque coin de l'utilisateur portant l'espèce : `+0,5 · exp(−d / 250 m)`, nul au-delà de 1 000 m ; maximum retenu sur les coins. Facteur `1 + bonus`. Ce bonus n'existe que localement.

## 5. Rang, classes et zones

**Seuils par espèce** (`thrClass`, `index.html:1423`). Pour chaque région, on calcule l'aptitude de toutes les forêts (`fx > 0`, une cellule sur deux, bonus nul, relevés de toutes les années) puis les quantiles 60 %, 85 % et 96,25 % (`tools/seuils.js`, `tools/ecrire_seuils.py`, stockés dans `<région>/zone.js` sous `MAP_THR_V6`). Classe : 4 « très élevé » si A ≥ q96,25 ; 3 « élevé » si A ≥ q85 ; 2 « moyen » si A ≥ q60 ; 1 « faible » sinon. Par construction, 3,75 % des forêts sont en très élevé, 15 % en élevé ou mieux, 40 % en moyen ou mieux. Le contrôle sur les 8 régions (cellules `fx > 0`, moyenne des 52 espèces) donne 3,8 à 4,4 %, 14,9 à 15,3 % et 40 % ; sur les seules cellules affichées par défaut (`fx = 1`), 14,8 à 16,2 % en élevé ou mieux et 39,7 à 44,5 % en moyen ou mieux (écart dû aux cellules exclues, D8).

**Rang** (`staticFor`, `index.html:1605`). Percentile de chaque cellule parmi les cellules utilisables, par histogramme à 2¹⁸ classes (ex æquo traités par rang moyen).

**Pourcentage affiché** : `aptPct = 100 · A / A_max`, A_max étant le meilleur A de l'espèce dans la région chargée. Les pourcentages de seuil affichés sont `100 · q / A_max`.

**Zones de forêt** : la classe d'une zone est celle de son 80ᵉ centile d'aptitude (ses 20 % meilleures cellules) ; l'indice relatif de la zone est son rang cumulé pondéré par la surface (`index.html:1632-1637`).

## 6. Conditions du moment

Mode « conditions du moment » (météo pour la date choisie, mesures puis prévisions).

- **Saison** (`seasonF`, `index.html:1484`) : profil mensuel des relevés SwissFungi de l'espèce, interpolé linéairement entre les mois (position = mois + (jour − 15) / 30,5), divisé par son maximum, puis élevé à 0,7. Décalage d'altitude `seasonShift = clamp((alt − 600) / 250 · 7, −28, 28)` jours (D3). Le poids de la saison dans l'indice est `seasonW = s^(1,6/0,7)`, soit (relevés)^1,6.
- **Eau du sol** (`weatherCell`, `etTurc`, `index.html:1660-1681`) : seau de 60 mm initialisé à 60 % ; chaque jour, + pluie − évapotranspiration de Turc (`0,013 · T/(T+15) · (23,885 · Rs + 50)`, rayonnement estimé par `Rs = Ra · (0,25 + 0,5 · ensoleillement)`) ; moyenne du taux de remplissage du 14ᵉ au 3ᵉ jour avant la date. Correction locale : `+ 0,15 · mi/100`. Facteur `soilW` = min(1, (0,15 + 0,85 · clamp((sol − 0,35) / 0,45, 0, 1)) · (1 + 0,3 · nord · (1 − sol))), avec nord = −SOUTH/0,8 (versants nord favorisés quand le sol est sec).
- **Température du sol à 10 cm** : récurrence `ts ← ts + 0,128 · (T_air + 1,77 − ts)` depuis le début de la série ; calée sur la station d'Aigle 2016-2026 (erreur 0,8 °C contre 2,23 °C). Température utilisée : `T = ts − 1,77 + SOUTH · (0,4 + 1,2 · ensoleillement 10 jours) − 0,0055 · (altitude − altitude de la maille)`. Facteur `tempF = max(0,05, trapèze(T))` ; trapèzes de température d'expert par espèce.
- **Gel** : `fd = Σ max(0, −(Tmin + gradient)) / 3` sur les 7 derniers jours ; facteur `frost^fd` (frost entre 0,6 et 1 par espèce, d'expert).
- **Indice** : `W = seasonW × soilW × tempF × frostF`.
- **Classes de la carte** (`nowCls`) : coloré seulement si la classe statique est ≥ 2 ; classe selon `W`, exprimé en % de l'aptitude maximale du lieu : ≥ 0,45 jaune, ≥ 0,6 rose, ≥ 0,75 orange, ≥ 0,9 bleu. L'aptitude ne module donc pas W : elle ne sert que de filtre. **Depuis le 20 novembre 2026** (D1) l'aide et la fiche décrivent exactement ce comportement, et la fiche affiche la classe `nowCls`, celle de la couleur de la carte (l'ancienne fonction `wAdj`, décalage d'un ou deux crans, est supprimée).
- **Prévisions** : points de prévision locaux dans un rayon de 8 km, pondérés par `1/max(d, 500 m)²`, température corrigée de l'altitude (−0,0055 °C/m), pluie non corrigée.

## 7. Agrégations

- **Forte concentration** : chaque espèce affichée rapporte 3 (très élevé), 2 (élevé), 1 (moyen) points. Les seuils sont les maxima de : seuils fixes (2/4/6 points pour un palier, 4/6/8 pour toutes, réduits au prorata des espèces décochées) et quantiles 60/85/96 % des points sur les forêts chargées (`index.html:1781-1830`).
- **Meilleur lieu** (`findBest`, `index.html:2271`) : score de zone `(classe + qualité) × taille × part de bonne classe`, avec `sizeW(a) = 0,2 + 0,8 · clamp(ln(a/0,5)/ln(40), 0, 1)` (a = surface du massif continu en ha) et un facteur `0,6 + 0,4 · min(1, ha en classe max / 3)`. Ne modifie pas le score.

## 8. Ce qui n'entre pas dans le score

Chasse (hachures, calendriers VD et FR), contrôles VAPKO, zones de tir, accès aux transports, réserves (exclusion d'affichage avec la case « cueillette responsable »), lignes de niveau, pente forte (hachures à 30°). Les exclusions du point 3 de la section 3 retirent des cellules de l'affichage mais ne changent pas l'aptitude des autres.

## 9. Calibration

Poids globaux (non par espèce) ajustés le 20 novembre 2026 sur les relevés précis, par régression « présence contre fond groupe cible » (softmax conditionnel : la probabilité d'une cellule de présence parmi les cellules de fond, comme dans une maximisation de vraisemblance de type MaxEnt), exposants bornés entre 0 et 3, régularisés vers 1, évalués par validation croisée à 5 plis par blocs de 5 km (`fit.py`, branche `claude/project-thread-8xtobh` d'`app-champignons`). Résultat : hôte 0,2, altitude 0,6, SwissFungi ×1,15 ; type de forêt, peuplement, pente, humidité et sol laissés à 1. Rang hors échantillon contre le fond : 0,590 → 0,647. Le poids de l'hôte a ensuite été ramené de 0,2 à 0,1 à l'arrivée de la carte WSL (W_WSL = 0,4, puis groupes 1,6 / 1,2 / 0,4), choix validé sur les mêmes relevés (0,639 → 0,654 → 0,656).

Ne sont **pas** calibrés : les trapèzes de température, le gel, les tables type de forêt × espèce, les préférences de sol, le décalage de saison (7 jours par 250 m), la pénalité WSL (0,6 / 0,3), la fiabilité par classe WSL (0,8 / 0,6), les seuils des classes météo. Ce sont des valeurs d'expert (tableau complet dans `docs/provenance-parametres.md`).

## 10. Validation

### 10.1 Protocole
- **Présences** : 230 relevés précis (incertitude de position ≤ 100 m) de GBIF, presque tous iNaturalist « research grade », téléchargés le 17 novembre 2026 ; 37 des 52 espèces sont représentées dans des cellules de forêt (38 dans le fichier brut ; les autres, dont la girolle, n'ont aucun relevé précis).
- **Fond** : 5 197 relevés précis de champignons, toutes espèces (« groupe cible »), censés représenter l'effort d'observation.
- **Mesures** (`ev0.js`, `summ.py`) : `pct` = rang de la cellule du relevé parmi toutes les forêts de la carte (0,5 = hasard) ; `pctBg` = rang parmi les cellules du fond (corrige le biais d'accès) ; indice de Boyce continu (fenêtres de 0,2, pas de 0,05, corrélation de Spearman du rapport observé/attendu) ; part des relevés en classe élevée ou plus (15 % attendu au hasard).
- Doublons espèce × cellule retirés.

### 10.2 Résultats, rejoués sur le code actuel (20 novembre 2026)
Rejoué avec `docs/rapport-methode-verif/rerun.js` (même protocole, code et seuils de `main`) :

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
| Sans le coprin chevelu | 159 | 0,683 | 0,690 | — | — |

Intervalle à 95 % par rééchantillonnage de blocs de 5 km : pct [0,611 ; 0,716] (247 paires, 59 blocs), [0,607 ; 0,725] (185 distincts, 48 blocs) ; pctBg [0,617 ; 0,706] et [0,621 ; 0,722].

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

## 12. Table de correspondance « formule → code »

| # | Formule / paramètre | Fichier : ligne ou fonction | Vérifié |
|---|---|---|---|
| 1 | Produit des facteurs A(i,s) | `index.html:1588` `aptAt` | oui |
| 2 | Type de forêt, inconnu = moyenne | `index.html:1559` `habF`, table `HAB` `1549` | oui |
| 3 | Hôte (4 formes + racine carrée) | `index.html:1447` `hostF` | oui |
| 4 | Exposant hôte W_HOST = 0,1 | `index.html:1561, 1587` `hostW` | oui |
| 5 | Essence WSL : valeurs 1 / 0,6 / 0,3, fiabilité 0,8 / 0,6 | `index.html:1566, 1575-1576` | oui |
| 6 | Groupes N 1,6 / B 1,2 / G 0,4 | `index.html:1569-1571, 1577` | oui (17 / 10 / 6 espèces) |
| 7 | Voisinage 50 m = 0,9 | `index.html:1579` `wslNear` | oui |
| 8 | Altitude : trapèze, plancher 0,03, exposant 0,6 | `index.html:1433, 1655, 1587` | oui |
| 9 | Peuplement (mature / edge / any) | `index.html:1458` `standF` | oui |
| 10 | Pente 25° → 45° | `index.html:1463` `slopeF` | oui |
| 11 | Humidité ±15 % / −10 % | `index.html:1465` `moistF` | oui |
| 12 | Sol : 1 − k · clamp(−p·t, 0, 1) | `index.html:1467-1468` `soilF` | oui (D11) |
| 13 | Présence : 1 / 0,914 / 0,83 | `index.html:1472` `regionF` | oui |
| 14 | Bonus coins +0,5 · exp(−d/250) | `index.html:1593-1599` `obsBonus` | oui |
| 15 | Seuils q60 / q85 / q96,25 | `tools/seuils.js`, `index.html:1423` `thrClass` | oui (recalculés) |
| 16 | Rang par histogramme | `index.html:1605-1645` `staticFor` | oui |
| 17 | Zone : 80ᵉ centile | `index.html:1632-1637` | oui |
| 18 | Saison, exposant 0,7, décalage 7 j / 250 m | `index.html:1483-1493` | oui (D3) |
| 19 | Poids saison s^(1,6/0,7) | `index.html:1682` `seasonW` | oui |
| 20 | Seau 60 mm, Turc | `index.html:1657-1681` | oui |
| 21 | Température du sol k = 0,128, +1,77 °C | `index.html:1666-1672`, `pipeline/v3/fit_tsoil.py` | oui |
| 22 | Température corrigée (exposition, gradient) | `index.html:1684-1700` | oui |
| 23 | Gel : degrés sous 0 °C ÷ 3, 7 jours | `index.html:1688, 1696` | oui |
| 24 | Classes « moment » 0,45 / 0,6 / 0,75 / 0,9 | `index.html:1739-1740` `nowCls` | oui (D1) |
| 25 | Forte concentration (3/2/1, quantiles) | `index.html:1769, 1781-1830` | oui |
| 26 | Meilleur lieu, sizeW | `index.html:2270-2294` | oui |
| 27 | Flou des coins partagés | `index.html:2815` `seBlur` | oui (section 14) |
| 28 | Conversion feuillus → conifères | `index.html:3290` | oui |
| 29 | Exclusions, zones, humidité, sol, type de forêt | `pipeline/vd/grid.py` | oui (régions récentes) |
| 30 | Interpolation des prévisions | `alertes/meteo_update.py:91-140` | oui |
| 31 | Validation (rang, Boyce) | `pipeline/validation/summ.py`, `docs/rapport-methode-verif/` | rejoué |
| 32 | Calibration des poids | `pipeline/validation/etape2/fit.py` (branche non fusionnée) | lu, non rejoué |

## 13. Divergences et bugs trouvés

Gravité : **A** à examiner en priorité, **B** à corriger dans les textes ou le code quand cela vaut la peine, **C** détail.

| # | Gravité | Écart | Preuve |
|---|---|---|---|
| D1 | **A** | La carte « conditions du moment » ne fait pas ce que l'aide décrit. L'aide dit « aptitude × saison × … » et que la météo abaisse ou relève la classe d'un ou deux crans ; la légende dit « % de l'aptitude maximale ». Le code colore par `nowCls` : seuil sur W seul (0,45 / 0,6 / 0,75 / 0,9), l'aptitude servant seulement de filtre (classe ≥ 2). La fiche (popup) affiche à la place une classe obtenue par `wAdj` (décalage de classe selon WT), qui peut différer de la couleur de la carte. | `index.html:1424, 1739-1740, 1929, 1956` |
| D9 | **A** | Type de forêt connu pour 5 % des forêts de Vully/Avenches, 37 à 43 % de Broye, Chablais alpin et Pays-d'Enhaut (84 à 92 % pour les trois anciennes régions et 93 % pour La Côte) ; ailleurs le facteur est neutre (moyenne de l'espèce) et le modèle y est moins discriminant. Cause probable : extraction incomplète de la carte des milieux dans `pipeline/vd/grid.py`. À vérifier avant d'annoncer ces régions comme équivalentes. | mesure sur les tuiles, section 3 |
| D8 | B | Régions nyn, bro, vul, chb, pde : les couches (hauteur, conifères, pente, etc.) des cellules `fx = 2` ou `3` sont à zéro (`np.where(F, …, 0)`), alors qu'elles sont conservées pour ple, lsn, gdv. Si l'on affiche les forêts exclues, leur score est calculé sur des valeurs nulles. Les seuils sont calculés sur toutes les cellules `fx > 0` (4,6 à 14 % de cellules exclues, 33 % pour lsn) : jusqu'à 44,5 % des forêts affichées (Vully ; 43,2 % à Lausanne) sont en « moyen ou mieux » au lieu de 40 %. | tuiles ; `pipeline/vd/grid.py:135, 213-216` ; `tools/seuils.js` |
| D7 | B | Les poids et la validation du 20 novembre datent d'avant la correction de la couche conifères (inversée). Les valeurs de la documentation (0,656) sont exactes pour la couche inversée ; avec la couche corrigée, 0,663. L'explication « double emploi hôte / type de forêt » n'est pas démontrée (section 10.3). | section 10.3 |
| D6 | B | « 247 relevés précis » = 247 paires (relevé, carte) pour **185 relevés distincts** (les cartes se recouvrent) ; la documentation et l'aide parlent de 247 relevés. | `rerun.js` : 247 / 185 identifiants |
| D4 | B | Le texte de la fiche (« conifères ×0,1 ; essence dominante WSL ×0,4 ; altitude ×0,6 ») est inexact : l'exposant de l'essence WSL est 1,6, 1,2 ou 0,4 selon l'espèce, et celui de l'hôte vaut 0,05 quand le type de forêt est connu. L'aide « Comment le score est calculé » ne mentionne pas du tout le facteur WSL. | `index.html:1569-1577, 1927` ; aide `index.html:1237-1250` |
| D5 | B | L'aide affiche encore la validation du 15 novembre (51 observations, rang 52 à 54 sur 100) ; l'état actuel est 0,66 (247 paires, 185 relevés). | `index.html` aide, ligne « Validation (15.11.2026) » |
| D10 | B | Les cinq régions récentes n'ont pas de repli sur l'atlas géochimique là où GeoCover manque (sol neutre) : sol connu pour 81 % (Pays-d'Enhaut) à 99,7 % (Vully). L'aide annonce le repli. | `pipeline/vd/grid.py:173-174`, aide `index.html:1243` |
| D14 | B | Les scripts de validation de `main` d'`app-champignons` (`ev0.js`) échouent avec le code actuel (`aptAt(…, null)` alors que le 4ᵉ argument doit être un tableau) ; les scripts de calibration (`fit.py`, `evf.js`) sont sur une branche non fusionnée ; la validation de la carte WSL n'a aucun script versionné. Rejouable avec `docs/rapport-methode-verif/rerun.js` ajouté ici. | dépôt `app-champignons` |
| D2 | C | Constantes mortes : `AP`, `aClass` (jamais appelée), `SEASON_CAP` (la règle « moins de 30 % de saison, jamais en très élevé » n'est pas codée ; elle est vraie par construction, puisque W ≥ 0,9 exige une saison ≥ 0,955). | `index.html:1419, 1425, 1770` |
| D3 | C | Le décalage de saison est symétrique : en dessous de 600 m, la saison est **retardée** (−8 jours à 300 m, −11 jours à 200 m). L'aide et le commentaire ne mentionnent que le décalage vers le haut. | `index.html:1483` |
| D11 | C | La pénalité de sol maximale est k·\|p\| et non k : 7,5 % (et non 15 %) pour les espèces à préférence ±0,5. | `index.html:1468` ; `docs/provenance-parametres.md` |
| D12 | C | Dans `wslRaw`, « même type » est défini par rapport au **premier hôte** de la liste (cèpe de Bordeaux : le sapin, donc un conifère non hôte compte 0,6 et un feuillu 0,3, alors que l'espèce est « both »). Choix d'expert non documenté. | `index.html:1575` |
| D13 | C | La russule des épicéas (`integra`, hôte épicéa unique) est dans le groupe généraliste (exposant 0,4) alors que les autres espèces à épicéa seul (`varius`, `vinosa`, `mustelina`, `imbricatus`) sont dans le groupe étroit (1,6). | `index.html:1570-1571` |
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
| D15 | **Corrigé en partie** | La température moyenne `t` inutilisée est retirée de `weatherCell` ; l'étiquette `meta.model` des anciennes tuiles reste (sans effet). |
| D8 | **Non traité** | Mettre les couches des forêts exclues (`fx` 2 et 3) au lieu de zéro demande de régénérer 5 régions ; l'effet (jusqu'à 44,5 % des forêts affichées en « moyen ou mieux » au lieu de 40 %) est signalé en section 5. |
| D7 | **Expliqué** | Section 10.3. |
| D14 | **Corrigé** | `docs/rapport-methode-verif/rerun.js` rejoue la validation sur les huit régions. |

Vérifié sans écart : paramètres du tableau `docs/provenance-parametres.md` (altitude, température, gel, sol, hôte pour les 52 espèces, comparés au code) ; seuils V6 présents et croissants pour les 52 espèces des 8 régions ; correspondance des codes de type de forêt entre le script et `HAB_LAB` ; indices des essences WSL entre `WSL_HOSTS`, `WSL_NAMES` et `WSL_REL` ; 0,914 et 0,83 = 0,925 et 0,85 à la puissance 1,15 ; surfaces de `sizeW` annoncées dans l'aide (0,7 pour 5 ha).

## 14. Éthique, confidentialité, sécurité

- **Cueillette responsable.** Option qui grise les réserves naturelles, les marais d'importance nationale et la zone centrale du Parc du Jorat (OParcs art. 23), signale les milieux à ménager (amphibiens, zones alluviales, réserves forestières) et affiche une bannière en dehors de 7 h à 20 h (`RULES`, `index.html:1510`). Les règles communales ou cantonales ne sont pas modélisées au-delà du calendrier de chasse.
- **Sécurité.** Chaque fiche liste les sosies toxiques ; l'application ne remplace pas un contrôle VAPKO ; Tox Info Suisse 145 est affiché. Un classement « élevé » n'est pas une garantie de présence ni de comestibilité.
- **Coins privés.** Stockés localement (navigateur) ; leur sauvegarde et leur partage sont volontaires.
- **Envoi chiffré (consentement).** Le navigateur chiffre les coins avec la clé publique de l'auteur (ECDH P-256 éphémère, HKDF-SHA256, AES-256-GCM) ; un Worker Cloudflare les range tels quels dans un dépôt privé. Envoyé : espèce, latitude et longitude, mois, précision. Jamais : nom, photo, identité. Par défaut, la position est **floutée** à la case de 0,005° × 0,0075° (≈ 556 m × 574 m aux latitudes vaudoises), ramenée au centre de la case (`seBlur`, `index.html:2815`) ; ce n'est pas un flou aléatoire. La case d'accord n'est pas pré-cochée ; suppression possible par code. Le code est actif dans `main` (`SHARE_CFG` renseigné, ce que `docs/partage-chiffre.md` ne dit plus : il parle d'un code « désactivé »).
- **Données tierces.** Aucune donnée brute tierce n'est versionnée dans le dépôt public ; les observations iNaturalist (CC BY, CC BY-NC) ont été retirées du site le 20 novembre 2026 et ne servent que localement à l'import. La redistribution de la couche WSL est à clarifier avec le WSL (`docs/mail-wsl.md`). Le code est sous licence PolyForm Noncommercial 1.0.0.

## 15. Reproduire les vérifications de ce rapport

Dans `docs/rapport-methode-verif/` (Playwright, Chromium ; chaque script sert les fichiers de `main` par interception, sans serveur local) :
- `rerun.js` : rejoue la validation (sections 10.2 et 10.3) ; argument `inv` pour la couche conifères inversée, `host:<valeur>` pour changer W_HOST.
- `shares.js` : parts de forêts par classe, cellules affichées contre toutes les cellules (section 5).
- `summ2.py` : pct, pctBg, Boyce et part en classe élevée à partir des sorties de `rerun.js`.
- `resultats.json` : résultats agrégés (aucune donnée individuelle).
Le fichier des relevés précis (`pipeline/validation/valid_obs.json`) reste dans le dépôt privé `app-champignons`.

## 16. Références (existence vérifiée, texte intégral non lu pour la plupart)

Koch, Hobi, Morsdorf, Waser (2024) : carte 10 m des essences, EnviDat, doi 10.16904/envidat.506. Boyce, Vernier, Nielsen, Schmiegelow (2002) : évaluation de modèles de sélection d'habitat (indice de Boyce) ; Hirzel et al. (2006) : Boyce continu. Phillips, Anderson, Schapire (2006) et Phillips, Dudík (2008) : modélisation MaxEnt, fond « groupe cible » (target-group background). Pistes de lecture pour le décalage de saison en altitude et la fructification en Suisse : voir `docs/provenance-parametres.md` (références non encore confirmées).
