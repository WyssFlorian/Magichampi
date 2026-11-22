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
- Coût = temps × facteur de réseau : chemins 4-5 : 1 ; sentier balisé : 0,7 ; classe 3 : 3,5 ; classe 2 (bord de route) : 6 (3 si balisé) ; traversée de classe 1 : ×12 + 2 min. « Envie de détour » (0 à 3) : jusqu'à −60 % de coût sur les arêtes qui traversent des cellules classées élevé / très élevé dans le mode affiché.
- Difficulté, 5 niveaux (très facile … très difficile) : maximum du niveau « effort » (durée, dénivelé positif) et du niveau « technique » (pente soutenue, sentier de montagne / alpin, sentier non balisé, zone difficile d'accès), avec la raison affichée. Seuils estimés, à caler sur des parcours connus.
- Les tronçons de classe 2 sont tracés en orange tireté avec « Bord de route : attention à la circulation » ; les traversées en rouge pointillé.
- Limites : une seule région à la fois (les régions se recouvrent d'1 km) ; pas de météo ni de chasse dans le calcul (PR suivantes) ; la déclaration de responsabilité formelle viendra dans la PR « avertissements ».

## Balade en boucle et export GPX (PR 2 sur 4)
Menu ☰ › Itinéraire › Type « Balade en boucle » : un départ, une cible en distance (2 à 20 km) ou en durée de marche (30 min à 6 h). Trois variantes, triées par écart à la cible, choisies par boutons.
- Méthode (heuristique, pas un optimum) : triangle départ → W1 → W2 → départ, W1 et W2 à la distance r du départ et à 60° d'écart. Les directions sont choisies là où le mode affiché est le meilleur (« envie de détour » ≥ 1), trois directions écartées d'au moins 90°. Les arêtes déjà empruntées coûtent ×6 pour éviter les allers-retours. r est ajusté (9 essais) jusqu'à ±10 % de la cible ; sinon la page le dit. Rayon limité à 8 km, calcul de 0,05 à 0,5 s.
- Les variantes à plus de 35 % de la cible sont écartées s'il en reste d'autres.
- Export GPX (trace sans altitude) pour tout itinéraire, A→B ou boucle.
- Pas encore pris en compte : zones de chasse (pénalité), météo (PR suivantes).
