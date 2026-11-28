# Itinéraires : graphe précalculé et calcul A→B

Étude et décisions : voir le fil « Étudier le coût des itinéraires découverte » (22 nov. 2026). Cette page décrit ce qui est réalisé (PR 1 sur 4).

## Graphe (`<région>/graphe.json`, `tools/graphe.py`)
Construit à partir de `routes.geojson` (classes 1 à 5), `sentiers.geojson` (Wanderweg / Bergwanderweg / Alpinwanderweg) et des tuiles `grid/` (altitude, pente, forêt) : aucune donnée nouvelle, aucune source externe. `python3 tools/graphe.py [région …]` (dépendances : numpy, scipy, shapely, pyproj ; ≈ 2 min pour les huit régions).
- classe 1 (autoroutes, routes larges) : exclue ; seule exception, une **traversée** = arête virtuelle (classe 1, ≤ 30 m) entre deux bouts de chemin situés de part et d'autre d'une route de classe 1 (jamais le long de la route) ;
- raccords entre lignes à 5 m, nœuds à toutes les intersections, sentiers balisés fusionnés avec la route qu'ils suivent (≤ 6 m) ;
- par arête : classe, type de sentier, longueur, dénivelé + / −, pente maximale soutenue (≈ 100 m), part de pente ≥ 30° en forêt (zone difficile d'accès), part de forêt.
Poids : **18.7 Mo** pour les huit régions (≈ 6,8 % de la marge de 275 Mo). Ajouté à `files.json` de chaque région (hors ligne).

## Connectivité (part des tronçons dans la plus grande composante · part de la forêt à ≤ 300 m de celle-ci)
| région | graphe (Mo) | classes 3-5 + sentiers (sans classe 2) | + classe 2 | + traversées de classe 1 |
|---|---|---|---|---|
| Riviera-Chablais | 1.88 | 22.9 % · 50.0 % | 88.0 % · 84.9 % | 94.8 % · 85.5 % |
| Lausanne | 2.06 | 1.9 % · 10.7 % | 74.2 % · 93.7 % | 92.9 % · 99.3 % |
| Gros-de-Vaud | 3.17 | 6.8 % · 23.1 % | 82.6 % · 89.1 % | 92.8 % · 95.0 % |
| La Côte / Jura | 2.91 | 20.5 % · 49.9 % | 84.1 % · 91.5 % | 95.1 % · 92.8 % |
| Broye | 3.02 | 13.3 % · 29.3 % | 67.6 % · 62.2 % | 69.2 % · 63.7 % |
| Vully / Avenches | 2.12 | 4.8 % · 6.1 % | 82.2 % · 93.5 % | 96.1 % · 98.0 % |
| Chablais alpin | 2.33 | 43.2 % · 49.2 % | 91.2 % · 82.8 % | 95.9 % · 84.0 % |
| Pays-d'Enhaut | 1.23 | 55.0 % · 62.7 % | 82.6 % · 77.0 % | 93.7 % · 79.2 % |

Lecture : sans la classe 2, le réseau est très fragmenté (Lausanne, Vully, Gros-de-Vaud : moins de 10 % des tronçons dans la même composante) ; la classe 2, même pénalisée ×6, est donc indispensable (décision de Florian du 22 nov.). Détail : `docs/graphe-rapport.json`. Points faibles connus : la Broye reste à ≈ 69 % (coupures dans le réseau simplifié, à examiner) ; en plaine, un itinéraire peut être nettement plus long que la ligne droite (≈ 2 à 5 ×) faute de raccord.

## Calcul dans la page (`itineraire.js`, menu ☰ › Itinéraire)
- Temps de marche : fonction de Tobler appliquée au dénivelé brut de chaque arête, ×1,3 sentier de montagne, ×1,6 sentier alpin ; arrondi à 5 min, annoncé ±10 min.
- Coût = temps × facteur de réseau : chemins 4-5 : 1 ; sentier balisé : 0,7 ; classe 3 : 1,6 ; classe 2 (bord de route) : 3,5 (2 si balisé) ; traversée de classe 1 : ×12 + 2 min. « Envie de détour » (0 à 3) : jusqu'à −60 % de coût sur les arêtes qui traversent des cellules classées élevé / très élevé dans le mode affiché.
- Difficulté, 5 niveaux (très facile … très difficile) : maximum du niveau « effort » (durée, dénivelé positif) et du niveau « technique » (pente soutenue, sentier de montagne / alpin, sentier non balisé, zone difficile d'accès), avec la raison affichée. Seuils estimés, à caler sur des parcours connus.
- Les tronçons de classe 2 sont tracés en orange tireté avec « Bord de route : attention à la circulation » ; les traversées en rouge pointillé.
- Limites : une seule région à la fois (les régions se recouvrent d'1 km) ; pas de météo ni de chasse dans le calcul (PR suivantes) ; la déclaration de responsabilité formelle viendra dans la PR « avertissements ».

## Balade en boucle et export GPX (PR 2 sur 4)
Menu ☰ › Itinéraire › Type « Balade en boucle » : un départ, une cible en distance (2 à 20 km) ou en durée de marche (30 min à 6 h). Trois variantes, triées par écart à la cible, choisies par boutons.
- Méthode (heuristique, pas un optimum) : triangle départ → W1 → W2 → départ, W1 et W2 à la distance r du départ et à 60° d'écart. Les directions sont choisies là où le mode affiché est le meilleur (« envie de détour » ≥ 1), trois directions écartées d'au moins 90°. Les arêtes déjà empruntées coûtent ×6 pour éviter les allers-retours. r est ajusté (9 essais) jusqu'à ±10 % de la cible ; sinon la page le dit. Rayon limité à 8 km, calcul de 0,05 à 0,5 s.
- Les variantes à plus de 35 % de la cible sont écartées s'il en reste d'autres.
- Export GPX (trace sans altitude) pour tout itinéraire, A→B ou boucle.
- Pas encore pris en compte : zones de chasse (pénalité), météo (PR suivantes).

## Tout-terrain (bêta, PR 3 sur 4)
Case « Tout-terrain » dans Itinéraire (A→B seulement), désactivée par défaut, avec avertissement et case « Je comprends » obligatoires avant tout calcul.
- Dijkstra sur la grille de 25 m (≈ 17 m au sol) de la fenêtre chargée, reliée au réseau de chemins (les chemins sont des arcs cellule à cellule au coût du graphe). Fenêtre = départ/arrivée + 1,5 km, ≤ 450 000 cellules (≈ 10 km) ; temps de calcul 0,06 à 0,2 s.
- Hors chemin seulement : en forêt utilisable (réserves et zones exclues déjà gérées par `usable`), à ≤ 100 m d'une cellule « élevé » ou mieux du mode affiché ; Tobler ×1,6 ; pente 25-30° ×3, ≥ 30° refusée ; cours d'eau (`cours_eau.geojson`, tampon d'une cellule) et marais (`reserves.geojson`) refusés. Franchissement d'un cours d'eau seulement par un chemin du réseau.
- Tracé violet pointillé, difficulté d'office au moins « difficile », longueur hors chemin affichée.
- Limites : ruisseaux non cartographiés et fossés non vus ; ponts non distingués ; chasse (hachures) non pénalisée ; pas de météo (durcissement automatique : PR 4) ; pas de tout-terrain pour les boucles.

## Avertissements météo, déclaration de responsabilité et tests (PR 4 sur 4)
- **Météo** (données déjà dans la page : pluie, températures, maille de la carte) : bandeau « sol détrempé » si ≥ 30 mm en 3 jours ou ≥ 60 mm en 7 jours ; « pluie annoncée » si ≥ 15 mm dans les 48 h ; « gel possible en altitude » (gradient −5,5 °C / 1 000 m) vers la plus haute altitude du tracé ; si la météo de la carte n'est pas à jour, l'avertissement le dit. Seuils estimés, à caler.
- **Tout-terrain et météo** : sol détrempé → pente maximale 25 ° et tampon de 2 cellules autour des cours d'eau ; refusé si ≥ 50 mm en 3 jours, ≥ 40 mm annoncés en 48 h ou gel / neige possibles. Pas de prévision à 48 h MétéoSuisse séparée (option non réalisée : le message renvoie à la prévision officielle).
- **Décharge de responsabilité** : fenêtre affichée avant le premier calcul (« Toujours actif » mémorise l’acceptation en local, rappelée par un lien sur chaque itinéraire) ; paragraphe dans « Sources et limites ».
- **Hors ligne** : `graphe.json` est dans le `files.json` de chaque région et `itineraire.js` dans le cache de l'application ; le tout-terrain lit `cours_eau.geojson` et `reserves.geojson`, déjà hors ligne.
- **Tests** : `node tools/tests/itineraires.test.js [région …]` (Playwright, iPhone 13, sans réseau) : graphe, A→B, boucle, tout-terrain, météo, déclaration, sur les huit régions.

## Ajustements du 22 nov. (routes, bande de 20 m, détours utiles)
- Routes relevées d'un cran : classe 2 ×6 → ×3,5 (balisé ×3 → ×2), classe 3 ×3,5 → ×1,6. Classe 1 inchangée. Simple message d'attention « Bord de route » jusqu'à la classe 2.
- Tout-terrain : pas de pas hors chemin dans une bande de 20 m le long des routes de classe 2 (on suit la route, par ses arcs). Les chemins qui traversent la bande restent praticables.
- Envie de détour : le bonus ne vise plus que les zones « moyen » ou mieux (poids 0 pour « faible »). Un détour (A→B comme tout-terrain) n'est gardé que s'il apporte au moins 100 m de zones « moyen » ou mieux ET au moins 20 % de la distance ajoutée ; sinon le trajet le plus court est gardé (message affiché).

## Options du 23 nov. (tout-terrain en boucle, difficulté maximale, rythme, export swisstopo)
- **Tout-terrain en boucle** : la case n'est plus réservée à A→B. Chaque tronçon de la boucle (départ → W1 → W2 → départ) est calculé par le tout-terrain (mêmes règles, météo et avertissements) ; pas de pénalité des arêtes déjà utilisées en mode tout-terrain (un retour sur ses pas est possible). Refusé si la difficulté maximale est sous « difficile ».
- **Difficulté maximale** (curseur, très facile … très difficile, défaut : aucune limite), pour A→B et boucle : niveau technique de chaque arête (pente, sentier de montagne / alpin, zone difficile d'accès, sentier non balisé) ; les arêtes au-dessus du maximum sont pénalisées ×6 puis ×40 ; pour les boucles, si c'est l'effort (durée, dénivelé) qui dépasse, la cible est réduite (×0,75 puis ×0,55). Si rien ne convient, le plus facile trouvé est affiché avec un message.
- **Rythme** (curseur) : durée affichée = durée de marche × facteur (½ jogging, ¾, 1, 1,5, 2, 3 fouille complète). Pour une boucle ciblée en durée, la cible porte sur la durée affichée (la distance diminue avec un facteur élevé). Le niveau d'effort de la difficulté ne descend jamais sous la durée de marche normale.
- **Export swisstopo** : KML (trace + départ + arrivée) partagé par la feuille de partage du téléphone (ou téléchargé), importable dans map.geo.admin.ch (Outils avancés › Importer un fichier). Lien « Ouvrir map.geo.admin.ch » centré sur le départ (coordonnées LV95 approchées, ± 1 m). Le viewer ne documente pas de paramètre d'URL pour tracer une ligne ni charger un KML depuis l'URL, et l'import dans l'app mobile swisstopo n'est pas documenté : à vérifier sur iPhone.
- Tests : `node tools/tests/itineraires-options.test.js [région]`.

## Tout-terrain à tous les niveaux de difficulté (23 nov.)
La case « Tout-terrain (bêta) » reste sélectionnable et active quel que soit le curseur « Difficulté maximale », en A→B comme en boucle (plus de refus sous « difficile », plus de mention « désactivé par défaut »). Le hors-chemin s'adapte au maximum choisi : une cellule n'est praticable que si elle est près d'un chemin du réseau ET sous une pente maximale, en plus des règles existantes (forêt utilisable, ≤ 100 m d'une zone « élevé » ou mieux, ni cours d'eau, marais, réserves, ni bande de 20 m le long des routes de classe 2).

| difficulté maximale | distance max. à un chemin | pente max. en hors-chemin |
|---|---|---|
| très facile | 25 m | < 8° |
| facile | 50 m | < 15° |
| moyen | 100 m | < 20° |
| difficile | 200 m | < 25° |
| aucune limite | illimitée (toujours près d'une zone favorable) | < 30° (25-30° ×3 plus lent) |

- Le niveau de difficulté du tout-terrain n'est plus d'office « difficile » : c'est le maximum de la classe de distance et de la classe de pente des cellules réellement traversées hors chemin (mêmes seuils que le tableau ; au-delà de 200 m ou 25° = très difficile).
- Météo défavorable : inchangée (pente ≤ 25° et marges élargies si sol détrempé ou gel ; refus si pluie forte).
- Si aucun passage hors chemin n'existe sous ces limites, le tracé reste sur les chemins (ou un message l'indique).
- Dans la page : texte d'aide de la case (visible dès qu'on la coche) et rappel de la règle dans l'avertissement du résultat. Tests : `itineraires.test.js` (niveau ≤ maximum de 0 à 3) et `itineraires-options.test.js`.

## Boucles : forêt et allers-retours (23 nov.)
Cas signalé : à Semsales, des boucles allaient et revenaient par le même tronçon dans les champs.
- **Choix des étapes** : secteurs et noeuds scorés avec la part de forêt des arêtes en plus de la zone favorable (poids 0,5).
- **Qualité mesurée** (`loopMetrics`, échantillons de 20 m) : part du tracé en forêt, part en zone « moyen » ou mieux en forêt, part de tronçons déjà parcourus (cellule voisine visitée ≥ 80 m plus tôt) et **impasses** = tronçons répétés qui n'atteignent aucune zone « moyen » ou mieux en forêt (un aller-retour qui atteint une telle zone reste permis, avec une pénalité légère).
- **Sélection** : après l'ajustement du rayon, plusieurs couples d'étapes sont testés (3 rayons en tout-terrain, 5 sinon, 5 directions sur chemins) ; coût = écart à la cible + 3 × impasses + 0,7 × répétitions − 0,5 × zone favorable − 0,3 × forêt (+1 si la difficulté maximale est dépassée), cible à ±15 %. Les boucles à plus de 3 % d'impasses sont écartées s'il en reste d'autres ; sinon un message l'annonce.
- **Chemins** : arêtes déjà utilisées ×12 (au lieu de ×6). **Tout-terrain** : les cellules déjà empruntées par un tronçon précédent (et leurs voisines) coûtent ×4 pour les tronçons suivants.
- Le résultat affiche « En forêt : x % · tronçons parcourus deux fois : y % ».
- Mesure (Semsales 46,5747 / 6,9311, région ple, cible 2 h, rythme ×1,5, léger détour, aucune limite ; 3 essais, moyennes sur les boucles proposées) : sur chemins, impasses 27 % → 7 %, répétitions 29 % → 11 %, forêt 0 % → 8 % ; tout-terrain, impasses 25 % → 1 %, répétitions 49 % → 20 %, forêt 18 % → 16-23 % (variable). La forêt est à plus de 3 km à l'est du village : une boucle de 5 km n'y entre guère.
- Test : `node tools/tests/boucle-champs.test.js [essais]` (compare `ITIN.setLoopQ(false)` et `true`).


## Édition du tracé par clic-glisse (23 nov. 2026)
- Une fois un trajet affiché, saisir le tracé (souris : 9 px de tolérance ; doigt : 20 px) et le glisser ajoute un point de passage là où on lâche, inséré dans l'étape touchée (liste réordonnable, 8 max). Les étapes sont recalculées avec les mêmes règles (difficulté, dénivelé, tout-terrain).
- Un simple appui ne change rien ; la carte ne se déplace pas pendant le glissement, la vue n'est pas recadrée. Si le nouveau point est inaccessible (à plus de 300 m d'un chemin, ou étape sans chemin), il n'est pas ajouté et le tracé précédent est rétabli. L'ordre optimisé est désactivé pour garder l'ordre du glissement.
- Test : `node tools/tests/itineraires-glisser.test.js [région]`.

## Moins de kilomètres hors forêt (23 nov. 2026)
- Le coût d'une arête (A→B, boucle, points de passage, tout-terrain par les arcs du réseau) est multiplié par `1 + OFFP × (1 − fo/100)`, `fo` étant la part de l'arête en forêt déjà stockée dans `graphe.json`. `OFFP = 4` : une arête entièrement hors forêt coûte 5 fois plus. Les traversées de classe 1 ne changent pas. Les contraintes restent celles d'avant (difficulté maximale, limite de dénivelé, classe 2 pénalisée, détour gardé seulement s'il apporte des zones « moyen » ou mieux). Dans le choix d'une boucle, le poids de la part en forêt passe de 0,3 à 1 (`LFW`).
- Mesure (`ITIN.setOffP(0)` = ancien comportement ; 34 à 36 trajets A→B de 1,5 à 6 km entre points du réseau choisis au hasard, graine fixe, « léger détour » ; boucles de 6 km autour de 22 à 23 points). Part hors forêt = part des arêtes (`fo`), puis, entre parenthèses, part selon la grille de forêt de la carte (plus sévère : elle exclut la lisière) :
  - Riviera-Chablais : A→B 56,9 % → 50,3 % (74,6 → 71,4), longueur +5 % ; boucles 54,6 → 54,0 avec poids 0,3, 53,8 avec 0,8 et 52,3 avec 1,5.
  - Région lausannoise : A→B 56,3 → 45,9 % (64,2 → 57,6), longueur +11 % ; boucles 67,8 → 63,3 % (75 → 70,6).
  - Gros-de-Vaud : A→B 63,7 → 48,2 % (90,3 → 84,5), longueur +17 % ; boucles 59,8 → 49,7 %.
  - Pays-d'Enhaut et Diablerets (`pde`) : A→B 68,0 → 60,0 % (85,9 → 85,5), longueur +6 % ; boucles 70,7 → 65,3 %.
  - Réglage de OFFP sur Riviera-Chablais : 2 → −4,2 points pour +3 % de longueur, 4 → −6,6 pts pour +5 %, 8 → −10,7 pts pour +12 %. 4 retenu.
- Limites : en plaine, le réseau n'offre souvent pas d'alternative boisée, et départ ou arrivée en localité restent hors forêt ; le gain se voit surtout là où un chemin boisé parallèle existe. Test : `node tools/tests/itineraires.test.js` (inchangé, passe sur ple et lsn).

## Plafond strict de distance ou de durée (23 nov.)
- Le réglage « Cible » devient un **plafond jamais dépassé** (menu Itinéraire › « Plafond (jamais dépassé) ») : aucun / distance / durée de marche. « Aucun » n'existe que pour A→B ; une boucle a toujours un plafond. La durée est la durée affichée, rythme compris (×½ à ×3).
- S'applique à tous les types : boucle (y compris tout-terrain, variétés, points de passage), A→B, A→B tout-terrain, points de passage, point ajouté par glisser.
- Boucle : on vise le plafond moins 7 % au plus (jamais plus de 300 m / 7 min en dessous), toute boucle au-dessus est écartée (`over`). Si la difficulté maximale ou la limite de dénivelé obligent déjà à réduire la cible, cela reste sous le plafond.
- A→B et points de passage : si le trajet dépasse, on réessaie sans détour (envie 0) ; s'il dépasse encore, **rien n'est tracé** et le message donne le plafond et le trajet le plus court trouvé (« non affiché »). Un point ajouté par glisser qui ferait dépasser le plafond est refusé et le tracé précédent rétabli.
- Remplace les comportements tolérants : cible « ±10 % », « la cible est ignorée » avec points de passage en boucle.
- Test : `node tools/tests/itineraires-plafond.test.js [région]` (boucle, A→B, rythme ×3, points de passage). Les tests `itineraires-options` (étapes aléatoires, course entre deux calculs) échouent parfois, avec ou sans cette modification.

## Vague 2 (23 nov.) : vitesse des boucles et panneau simplifié
- **Calcul** : coûts de base des arêtes gardés en mémoire (`costBase`), pénalité de repassage appliquée à la volée ; tas typé ; boucles : un seul Dijkstra depuis le départ (`netDist`) pour choisir les étapes à la bonne distance **par les chemins**, rayon encadré par interpolation, 3 rayons d'exploration. Boucle de 8 km à CPU ×4 : 1 à 2 s (avant 3 à 7 s).
- **Panneau** : visibles seulement le type, les points, le plafond, 3 préréglages (Balade facile, Cueillette, Sportif) et Calculer ; le reste est dans « Réglages » (une ligne de résumé). Modifier un réglage désélectionne le préréglage.
- **Retours** : progression « direction i/n » + Annuler ; résultat sur une ligne avec « Détails » ; variantes de boucle avec D+ et forêt ; tronçons au-dessus de la difficulté maximale en noir pointillé.
- Détails et mesures : `docs/evaluation-itineraires.md`, section 6. Test : `node tools/tests/itineraires-panneau.test.js [région]`.

## Vague 3 (23 nov.) : tracés plus propres
- **Boucles** : repassage *spatial* (couloir d'environ 30 m autour des arêtes déjà prises, ×8, 60 m exemptés aux étapes) ; à l'exploration, essais avec et sans couloir + forme à 4 étapes en plus du triangle ; le coût de sélection pèse davantage les répétitions (2 au lieu de 0,7). Les boucles tout-terrain gardent leur pénalité par cellule.
- **A→B** : longueur ≤ 1,35 × le plus court chemin sous les mêmes limites (1,6 × en « grand détour »), pénalités relâchées par paliers ; la difficulté maximale, le dénivelé et le plafond strict restent prioritaires. Message « Détour limité à +35 % ».
- **Approcher le plafond (24 nov.)** : l'objectif est d'arriver à ≤ 1 km / ≤ 30 min du plafond choisi (sans jamais le dépasser). `fill()` (itineraire.js) ajoute des détours vers des points du réseau, de préférence en forêt, tant qu'il reste de la place : A→B (le plafond choisi prime sur le curseur de détour), boucles (sans impasse ni repassage supplémentaires au-delà de +3 % / +8 %). Si la boucle reste à > 600 m / 18 min du plafond, 2e passage avec une boucle générée plus grande (sans la marge de 16 % réservée aux meilleurs points) ; on garde le meilleur des deux. Pas de remplissage en tout-terrain ni avec points de passage. Mesure : `node tools/profil/itineraires-cible.js ple gdv`, test : `tools/tests/itineraires-cible.test.js`.
- **Tout-terrain** : part hors chemin plafonnée selon l'envie de détour (50 / 60 / 70 / 80 %), tracé hors chemin lissé (visibilité directe) au lieu de l'escalier de 25 m.
- Détails et mesures : `docs/evaluation-itineraires.md`, section 7. Test : `node tools/tests/itineraires-trace.test.js [région]`.

## Tout-terrain progressif, meilleurs points, parcours aléatoire (24 nov. 2026)
- **Progression** : s = min(difficulté, 3) + envie de détour (0 à 6). Hors chemin autorisé d'abord dans une bande étroite le long des chemins (s = 0 : ≈ 10 m, pente < 8°), qui passe à ≈ 30 m / < 12° avec allers-retours vers les zones à bon score (s = 4, moyen + détour), puis aux règles de la difficulté choisie (s = 6, difficile + grand détour = comportement d'avant). Les cellules hors bande restent praticables comme simple liaison (coût × 4). Sans détour, une récompense légère (×0,6) fait longer les bords, durée ≤ 1,1 × le plus rapide.
- **5 des 10 meilleurs points** : pics de score le long du réseau (`peaks`), filtrés par accessibilité (détour, difficulté), 10 meilleurs, 5 tirés au hasard et insérés un à un tant que plafond, difficulté et dénivelé tiennent (`enrich`). Boucles : générées à 84 % de la cible, la place libre sert aux points. Tout-terrain : les 10 meilleures zones, 5 retenues au plus (2 par étape en boucle).
- **Aléa** : graine tirée à chaque « Calculer » (bruit de coût lissé, choix des secteurs et étapes, points). Si rien n'est trouvé, relance sans aléa. `ITIN.setSeed(n)` fixe la graine, `ITIN.setAlea(false)` revient au comportement déterministe (tests).
- Correction : la durée « réelle » du tout-terrain (plafond de détour) ignore la pénalité de difficulté.
- Outils : `tools/profil/tt-essai.js`, `tools/profil/tt-bande.js`, test `tools/tests/itineraires-progressif.test.js`.

## Boucles qui restent dans les champs : diagnostic (28 nov. 2026)
Cas : Semsales, « Forte concentration / Stars », boucle de 8 km. Mesure : `node tools/profil/boucles-zones.js ple gdv [départs]` (part en forêt, part en zone « moyen » ou mieux, répétitions, temps).
- **Cause** : la 1re zone colorée est à 3,2 km de Semsales par le réseau. Le calcul d'orienteering (`loopOrient`) trouve bien des tournées vers elle (ex. 3 points, 7,7 km estimés), mais le tracé réel dépasse le plafond (10-11 km) parce que le retour est forcé par un autre chemin (repassage ×12 + couloir). La réparation retire alors les points un par un, il ne reste plus de boucle conforme, et l'ancienne méthode livre une boucle de 7,9 km dans les champs (forêt 0 %).
- **Essais** : (1) retour moins pénalisé (×3, ×1, sans couloir) avant de retirer un point : boucles qui atteignent la zone (7,0 km), forêt +1 à +3 points, mais répétitions ×1,5 (0,16 → 0,22) et les tests `itineraires-trace` / `boucle-champs` (répétitions ≤ 10 %) échouent ; (2) balayage de 8 secteurs avec bonus de gain pour le secteur le plus riche (rayon 1/4 puis 1/2 de la longueur) : forêt −3 points, abandonné, car la recherche locale maximise déjà le gain total des points atteignables. Non retenus.
- **Limite de fond** : quand la zone est à plus de la moitié de la longueur visée, une boucle de 8 km ne peut qu'y faire un aller-retour. Choix produit à trancher : accepter les allers-retours vers une zone (répétitions 25-50 %) ou rester dans les champs.

## Tout-terrain : plus de pas hors chemin dans les champs (28 nov. 2026)
Cas signalé (capture, boucle 3 h, « Cueillette », max moyen) : tracé violet pointillé (hors chemin) au milieu des champs, loin de toute zone colorée.
- **Cause** : dans `routeOff`, un pas entre deux cellules de chemin du réseau était permis même si aucune n'était utilisable hors chemin (`al` = forêt près d'une zone « élevé » ou mieux). Ces pas en ligne droite doublaient les arcs du réseau et coupaient à travers les champs.
- **Règle** : on ne quitte les arcs du réseau que pour entrer dans une cellule `al` (forêt, à ≤ 100 m d'une zone colorée de classe ≥ 3) ; entre cellules de chemin on passe par les arcs.
- **Mesure** (`node tools/profil/boucles-champs-tt.js ple 8` : boucles de 3 h, max moyen, léger détour, 8 départs dont Semsales) : pas hors chemin 19,3 km → 3,9 km sur 42-46 km de boucles ; hors forêt 69 % → 0,6 % ; à plus de 100 m d'une zone élevée 50 % → 0 %. Monotonie : 0 violation ; tests `itineraires*` et `boucle-champs` OK.
- Les variétés de plein champ (ex. Coprin chevelu) : la carte ne note que la forêt, donc aucune zone colorée en champ ; le hors-chemin y reste exclu.
