# Étude des algorithmes de tracé (27 nov. 2026)

Analyse seule : aucun changement de comportement de l'application. Périmètre : `itineraire.js` (1 201 lignes, 122 Ko) tel qu'il est sur `main` le 27 nov. (après les vagues 1 à 3 de `docs/evaluation-itineraires.md`, le tout-terrain automatique et progressif, les « 5 des 10 meilleurs points » et le remplissage vers la cible). Le bug « valide en moyen, échoue en très difficile » est corrigé dans un autre fil : ici on cherche sa **cause de fond** et les algorithmes qui l'évitent.

Outils ajoutés (mesure seulement, rien dans l'application) :
- `node tools/profil/algos-etude.js ple gdv` : banc d'essai des algorithmes sur `graphe.json`, sans navigateur.
- `node tools/profil/itineraires-monotonie.js ple gdv` : vérifie qu'un tracé trouvé à une difficulté maximale l'est encore à une difficulté plus permissive.
- Mesures de l'application : `node tools/profil/itineraires-mesure.js ple gdv` (iPhone 13 simulé, CPU ralenti ×4).

## En bref
- **Le calcul du plus court chemin n'est pas le problème.** Le réseau est petit (27 000 nœuds sur la Riviera, 47 000 dans le Gros-de-Vaud) : un plus court chemin prend ≈ 1 ms sur ordinateur, ≈ 5 ms sur téléphone. Les lenteurs et les échecs viennent de **l'empilement d'heuristiques autour** : échelles de pénalités, dichotomie, budgets de temps, aléa, 2e passage, insertion de points, remplissage.
- **Cause de fond du bug « moyen OK, très difficile échoue » : les contraintes sont des pénalités, pas des règles.** La difficulté maximale, la limite de dénivelé et le plafond sont traduits en surcoûts, puis vérifiés après coup à six endroits différents. Et le réglage de difficulté ne fait pas que desserrer une limite : il **change la méthode de recherche** (bande tout-terrain, récompenses, part hors chemin, nombre d'essais). Rien ne garantit donc qu'un réglage plus permissif trouve au moins ce que trouvait le réglage plus strict.
- **Trois algorithmes s'appliquent vraiment, tous hors ligne, sans données en plus :**
  1. **Plus court chemin sous contrainte de ressource par étiquettes** pour la limite de dénivelé : mesuré, il trouve **toujours** un tracé quand il en existe un (60/60 contre 58/60 et 52/60 pour l'échelle actuelle), en 20 à 33 ms sur ordinateur.
  2. **Boucles comme un problème d'« orienteering »** (recherche locale itérée sur une petite matrice de distances entre les meilleurs points) : la matrice de 40 points se calcule en 4 à 13 ms ; elle remplacerait le triangle, la dichotomie, l'insertion de points et le remplissage par une seule recherche bornée.
  3. **A\* avec repères (ALT)** pour accélérer les nombreux plus courts chemins des boucles : 10 fois moins de nœuds visités, 3 fois plus rapide, 1,7 à 3 Mo de mémoire, calculés au chargement (0,1 s).
- **Ce qui ne s'applique pas** : BRouter et GraphHopper (moteurs Java sur données OpenStreetMap, ni hors ligne dans le navigateur ni avec nos attributs forêt / score), Fast Marching et Theta\* sur la grille (gain de 2 % de longueur, déjà obtenu par le lissage actuel), hiérarchies de contraction (les coûts changent à chaque réglage).
- **Mesuré aujourd'hui** : pas d'échec dur « moyen OK, très difficile refusé » sur 28 cas tirés au hasard, mais la qualité n'est pas monotone (boucle de 7,6 km à « difficile », 2,3 km à « aucune limite », même départ), et le maximum « facile » n'est pas tenu dans 7 trajets A→B sur 8 sur la Riviera.
- **Deux trous de fond, sans algorithme savant** : la chasse n'est **pas** évitée par le tracé (elle n'est qu'affichée), et le hors-chemin dans les réserves ou les zones de tir dépend des cases d'affichage cochées.

## 1. Ce que fait le code aujourd'hui

| type | méthode actuelle | contraintes | comment elles sont tenues |
|---|---|---|---|
| A→B sur chemins | Dijkstra (`route`), coût = temps de Tobler × facteur de réseau × bonus de zone × pénalité hors forêt × bruit aléatoire | difficulté max, D+ (ou D±), plafond distance / durée, détour ≤ 1,35 × | difficulté : pénalité ×6 puis ×40 ; D+ : surcoût λ × D+ avec λ ∈ {0, 10, 40, 160, 640} ; plafond : refait sans détour ; puis vérifié après coup |
| A→B, enrichi | `enrich` (5 des 10 meilleurs points insérés un à un), `fill` (détours jusqu'à 1 km / 30 min sous le plafond) | mêmes | chaque insertion est refusée si une vérification échoue |
| boucle | triangle départ → W1 → W2 → départ (et forme à 4 étapes), rayon ajusté (9 essais) × 3 à 5 directions × exploration ; échelle de 30 crans parcourue par dichotomie ; budget 3 s / 9 s ; aléa puis relance sans aléa ; 2e passage agrandi ; puis `enrich` et `fill` | idem + repassage (couloir de 30 m) | même mélange de pénalités et de vérifications, plus budgets de temps |
| tout-terrain | Dijkstra sur la grille de 25 m (≤ 450 000 cellules) reliée au réseau, 8 voisins ; jusqu'à 2 + 4 + 4 résolutions complètes (force de récompense, part hors chemin), plus une par étape vers une zone forte | bande autour des chemins selon `min(difficulté, 3) + détour`, pente, eau, marais, plafond de durée, part hors chemin | cellules interdites (règles dures) + paliers de pénalité |
| points de passage | étapes A → 1 → … → B, ordre par force brute à vol d'oiseau | mêmes | même boucle « difficulté × dénivelé » |

### Diagnostic de fiabilité (causes de fond)
1. **Contraintes molles.** La difficulté maximale est une propriété de chaque tronçon : elle devrait **retirer** les tronçons trop difficiles du réseau, pas les rendre 6 ou 40 fois plus chers. Le dénivelé et le plafond sont des **ressources** cumulées le long du tracé : une pénalité à λ fixe ne garantit ni de trouver un tracé qui respecte la limite quand il existe, ni de trouver le meilleur (mesure en section 3).
2. **La difficulté change la méthode, pas seulement la limite.** Exemples dans le code : `offProg` (bande tout-terrain de 10 m à « sans limite » selon `min(M,3) + détour`), passage en mode « non progressif » à s = 6 (`hardP` : chemins en zone colorée ×3, part hors chemin jusqu'à 97 %), une seule tentative à M = 4 (pas d'échelle de pénalité), case « Je comprends » à partir de « difficile », budgets de temps qui coupent plus tôt quand la recherche est plus large. Résultat : **aucune garantie de monotonie** (un réglage plus permissif doit trouver au moins aussi bien).
3. **Vérifications dispersées.** `okS`, `dvOk`, `capOver`, `S.lvl <= M` et les tests de répétition sont recopiés dans `compute`, `computeLoop`, `computeWp`, `enrich`, `fill`, `loopRoutes`. Un oubli dans l'un d'eux suffit à afficher un tracé hors limites ou à en refuser un bon.
4. **Résultat dépendant de la machine.** Les budgets (1,3 s, 1,5 s, 2,5 s, 3 s, 9 s) arrêtent la recherche au temps écoulé : un téléphone lent obtient une autre boucle, voire aucune.
5. **Règles de sécurité liées à l'affichage.** `usable()` autorise le hors-chemin dans une réserve (`fx = 4`) si « cueillette responsable » est décochée, et dans une zone de tir si « accès » est décoché. La chasse (`huntArr`, jours de battue) n'entre pas dans le coût. Les zones de tranquillité de la faune et les districts francs fédéraux ne sont pas dans `reserves.geojson` (seulement marais et réserves Pro Natura).

## 2. Mesures de l'application aujourd'hui (CPU ×4, départ au centre)

| scénario | Riviera (`ple`) | Gros-de-Vaud (`gdv`) |
|---|---|---|
| A→B, plafond 8 km | refusé : le plus court fait 9,9 km (B à ≈ 3 km à vol d'oiseau) | 1,5 s, 7,8 km, 1 des 10 meilleurs points |
| A→B tout-terrain, détour 2 | 1,5 s (bloc figé 1,3 s), 7,3 km dont 4,7 km hors chemin | 0,7 s, 6,1 km dont 1,6 km |
| Boucle 8 km | 2,1 s, forêt 64 %, repassage 4 % | 1,0 s, forêt 52 %, repassage 14 % |
| Boucle 8 km « facile » + D± ≤ 200 m | **10,1 s, 3,4 km, niveau « difficile »**, forêt 25 %, repassage 24 % | 1,1 s, 7,9 km, facile, repassage 16 % |
| Boucle 6 km tout-terrain | **13,0 s, 1,8 km**, repassage 48 % | 3,3 s (bloc figé 2,9 s), 5,7 km, forêt 7 % |

Lecture : les cas simples vont bien ; **dès que les contraintes se combinent, la qualité s'effondre** (Riviera : boucle de 3,4 km au lieu de 8 km et au-dessus de la difficulté demandée ; boucle tout-terrain de 1,8 km au lieu de 6 km, à moitié en aller-retour). Ce sont exactement les cas où une méthode exacte sous contraintes ferait mieux qu'une échelle de pénalités.

### Monotonie de la difficulté (`itineraires-monotonie.js`, sans ralentissement CPU, graine fixe)
6 boucles de 8 km et 2 à 8 trajets A→B (1,2 à 3,5 km à vol d'oiseau, sans plafond) par région, chacun calculé avec la difficulté maximale 1 (facile) à 4 (aucune limite), détour 2 (réglage par défaut).
- **Aucun échec dur sur cet échantillon** (0 cas « trouvé à M, refusé à M' > M ») : le bug signalé dépend d'un départ et de réglages précis, d'où l'intérêt d'un test systématique.
- **Mais la qualité n'est pas monotone** : Riviera, même départ, boucle de 7,6 km à « difficile » puis **2,3 km** à « aucune limite » ; à l'inverse, les boucles « facile » font 4,9 à 5,1 km pour une cible de 8 km et prennent **9 à 10 s sur ordinateur** (≈ 40 s sur téléphone) contre 3 s aux autres niveaux.
- **Le maximum n'est pas tenu en A→B sur la Riviera** : avec « facile », 7 trajets sur 8 sont annoncés « moyen » ou « difficile » ; avec « moyen », un trajet est « très difficile ». Ces A→B font 4 à 14 km dont 1,3 à 8,5 km hors chemin pour 1,2 à 3,5 km à vol d'oiseau : c'est très probablement le **détour lui-même** (durée, dénivelé) qui fait monter le niveau d'effort, le détour n'étant pas soumis à la limite de difficulté. Exemple typique d'une préférence (détour) qui l'emporte sur une règle (difficulté maximale).
- Gros-de-Vaud : niveaux tenus, mais un départ sur six ne donne aucune boucle à aucun niveau (réseau morcelé).

## 3. Algorithmes évalués

Banc d'essai `tools/profil/algos-etude.js` : mêmes coûts que l'application (Tobler, facteurs de réseau, pénalité hors forêt ×5, traversées), sans la grille de classes ; 150 trajets de 1,5 à 6 km, puis 60 trajets de 2 à 7 km où la limite de dénivelé change le tracé. Temps sur ordinateur ; compter ×4 à ×6 sur un téléphone moyen.

### 3.1 Plus court chemin : A\*, bidirectionnel, ALT

| méthode | nœuds visités (médiane · 90e c.) ple | ms ple | nœuds gdv | ms gdv |
|---|---|---|---|---|
| Dijkstra (actuel) | 3 768 · 8 653 | 0,91 | 3 376 · 9 542 | 0,98 |
| A\* (vol d'oiseau) | 3 165 · 7 813 | 1,22 | 2 664 · 8 586 | 1,13 |
| Dijkstra bidirectionnel | 1 700 · 4 572 | 0,82 | 1 490 · 4 827 | 0,80 |
| **ALT (A\* + 8 repères)** | **341 · 1 114** | **0,29** | **356 · 1 415** | **0,31** |

Les quatre donnent exactement le même coût (0 écart sur 150 trajets). A\* à vol d'oiseau ne sert à rien ici : le coût minimal par mètre (0,42 s/m) est trop faible face aux coûts réels (pénalités hors forêt, facteurs de réseau). **ALT** : 8 repères, 16 tableaux de distances, 1,7 Mo (ple) à 3 Mo (gdv) en mémoire, 0,1 s au chargement du graphe, rien à télécharger.
- **Ce qu'il apporte vraiment** : un A→B prend déjà 5 ms sur téléphone, donc rien de visible en A→B. Le gain est pour les boucles, l'insertion des points et le remplissage, qui lancent des centaines de plus courts chemins (×3 sur ce poste).
- **Précaution** : les repères doivent être calculés sur une **borne inférieure** du coût réel (bonus de zone jusqu'à −60 %, bruit aléatoire jusqu'à ×0,5) : sinon le tracé n'est plus optimal. Concrètement, repères sur le coût « temps × facteur minimal », ce qui réduit le gain (estimé ×2 au lieu de ×3, à mesurer).

### 3.2 Limite de dénivelé : plus court chemin sous contrainte de ressource

Le problème exact : trouver le tracé le moins coûteux dont le D+ cumulé reste sous la limite (« Resource Constrained Shortest Path », NP-difficile en théorie, facile sur un réseau de cette taille). Comparés sur 60 trajets par région (limite = D+ minimal possible + 30 % de l'écart avec le D+ du plus court) :

| méthode | tracés trouvés ple | écart de coût à l'optimum (médiane · 90e c. · max) | ms | tracés trouvés gdv | écart gdv | ms |
|---|---|---|---|---|---|---|
| échelle actuelle (λ = 0 … 640) | 58/60 | 1,3 % · 11 % · 27 % | 6 | **52/60** | 4,9 % · 22 % · 42 % | 7 |
| LARAC (λ ajusté, 6 Dijkstra) | 60/60 | 0,2 % · 7 % · 78 % | 8 | 60/60 | 2,2 % · 24 % · 70 % | 10 |
| **étiquettes exactes** (dominance coût / D+, bornes par 2 recherches arrière, borne haute LARAC) | **60/60** | **0 (optimal)** | **19** | **60/60** | **0** | **33** |

- L'échelle actuelle **rate 3 à 13 % des cas** où un tracé conforme existe (l'appli affiche alors « voici le moins pentu »), et quand elle réussit, le tracé est jusqu'à 27-42 % plus mauvais que nécessaire (plus de route, moins de forêt).
- La méthode **par étiquettes** est exacte et reste rapide (≈ 800 étiquettes médianes, 100 à 200 ms sur téléphone) : c'est la bonne méthode pour le D+, le D± et le plafond de distance ou de durée (même mécanisme, une ou deux ressources). À appliquer à A→B et à chaque étape (points de passage, tronçons de boucle).
- LARAC seul ne suffit pas (écarts jusqu'à 70-78 %) mais sert de **borne** qui accélère les étiquettes.
- Limite : sur un réseau 3 à 5 fois plus grand (canton entier d'un bloc), il faudrait un plafond d'étiquettes ; pas le cas ici (une région à la fois).

### 3.3 Difficulté maximale : filtre au lieu de pénalité
Pas d'algorithme nouveau : **retirer** du réseau les tronçons au-dessus du maximum (`edgeTech(e) > M`), vérifier que départ et arrivée restent reliés, et seulement sinon proposer « le plus facile trouvé » (avec un message clair). Effet : la difficulté devient une règle tenue par construction, et la propriété de monotonie devient vraie pour le réseau (le sous-réseau de « moyen » est contenu dans celui de « très difficile »). L'effort (durée, D+ total) reste une ressource cumulée, traitée comme en 3.2.

### 3.4 Boucles : problème d'« orienteering »
Le problème des boucles est connu : passer par des points qui rapportent (zones colorées, les « meilleurs points ») en revenant au départ sous un budget de distance ou de durée. Les méthodes de référence sont la **recherche locale itérée (ILS)** et **GRASP** : on construit une tournée sur une petite matrice de coûts entre points candidats, puis on l'améliore par échanges (insérer, retirer, remplacer, 2-opt) et perturbations.
- **Mesure** : la matrice entre le départ et 40 points candidats coûte 4 à 13 ms (40 Dijkstra bornés), soit ≈ 50 ms sur téléphone. Une ILS de quelques milliers d'itérations sur 40 points prend moins de 50 ms (estimation, ordre de grandeur classique). Ensuite on relie les points retenus par les vrais tronçons (avec pénalité de repassage), et le validateur unique tranche.
- **Ce que ça remplace** : le triangle et la forme à 4 étapes, l'ajustement du rayon (9 essais), l'échelle de 30 crans parcourue par dichotomie, `enrich`, `fill` et le 2e passage agrandi. Le plafond devient le budget de l'orienteering (tenu par construction), la cible « à 1 km / 30 min près » un objectif, les meilleurs points les « gains ».
- **Gain attendu** (estimation, à mesurer) : boucle « facile + D± ≤ 200 m » sur la Riviera de 10 s à ≈ 1 s ; plus de boucle 2 fois plus courte que la cible quand une boucle conforme existe ; temps indépendant de la vitesse du téléphone (nombre d'itérations fixe, pas de budget en secondes) donc **même graine = même boucle partout**.
- **Risque** : c'est un remplacement, pas une rustine ; la qualité (forêt, repassage) doit être comparée boucle par boucle avec `itineraires-mesure.js` avant de retirer l'ancien code (garder les deux derrière un interrupteur pendant une version).

### 3.5 Tout-terrain sur la grille
| piste | s'applique ? | verdict |
|---|---|---|
| **Fonction de Tobler** | déjà là (×1,6 hors chemin, pente 25-30° ×3) | garder ; seule amélioration utile : pente prise dans le sens de la marche sur la pente du terrain, pas seulement entre centres de cellules (déjà le cas via le MNT) |
| **Moins de résolutions complètes** | oui | une A→B tout-terrain lance jusqu'à 10 Dijkstra sur 450 000 cellules (force de récompense 1 → 0,1, puis part hors chemin ×1,5 → ×5), une boucle trois fois plus. Une **recherche par dichotomie** sur la force (3 au lieu de 5) et **un seul arbre depuis le départ réutilisé** pour les étapes vers les zones fortes divisent le travail par 2 à 3 (estimation) : c'est là que se trouvent les 13 s de la boucle tout-terrain de la Riviera |
| A\* sur la grille | faible | la récompense hors chemin (coût × 0,03 au mieux) rend toute borne inférieure presque nulle : peu de gain sauf sans détour |
| 16 voisins au lieu de 8 | oui, petit | l'erreur d'angle passe de 8 % à 3 % au plus, le tracé choisi est plus juste (pas seulement plus joli) ; coût ×2 par cellule, compensé par la ligne précédente |
| Theta\* (tracé en ligne droite pendant la recherche) | non | le lissage par visibilité directe fait déjà 97,7 % du gain (escalier résiduel 2,0 à 2,5 %), pour un coût 5 à 10 fois plus élevé |
| Fast Marching (front d'onde continu) | non | l'effort de Tobler dépend du sens de la pente (anisotrope) : il faudrait la variante « Ordered Upwind », lourde à écrire, pour un gain de quelques % de longueur |
| Web Worker | oui | supprime les blocs figés (2,9 s mesurés) ; déjà proposé (proposition 10 de l'évaluation du 23 nov.) |

### 3.6 Moteurs existants : BRouter, GraphHopper
| moteur | ce qu'il fait bien | pourquoi pas ici | idée à reprendre |
|---|---|---|---|
| BRouter | profils de coût scriptés, hors ligne sur Android, très bon en randonnée | Java, données OSM propres (fichiers `.rd5` de 5° × 5°), pas de version navigateur ; ne connaît ni la forêt WSL, ni le score, ni le hors-chemin sur grille | **filtre d'hystérésis sur l'altitude** (ignorer les bosses < ≈ 5-10 m) : le D+ des arêtes vient du MNT de 25 m et peut être gonflé par le bruit ; à vérifier dans `tools/graphe.py` |
| GraphHopper | hiérarchies de contraction, repères (ALT), boucles « round trip », itinéraires alternatifs | serveur Java, données OSM, les hiérarchies supposent des coûts fixes alors que les nôtres changent à chaque réglage ; un serveur casserait le hors ligne et coûterait | **ALT** (3.1) et **alternatives par pénalité** pour les variantes de boucle |
| Valhalla, OSRM | idem | idem | — |

Poids : aucun de ces moteurs n'apporte de données utiles que le graphe actuel (18,7 Mo pour 8 régions) n'a pas déjà ; leur intégration ajouterait plusieurs dizaines de Mo par région et une seconde source de réseau à tenir à jour.

### 3.7 Zones à éviter : chasse, réserves, champs, routes
| zone | aujourd'hui | proposition |
|---|---|---|
| routes | classe 1 interdite sauf traversée, classe 2 ×3,5 (×2 si balisée), classe 3 ×1,6, bande de 20 m sans hors-chemin | bon ; garder |
| champs (hors forêt) | coût × (1 + 4 × part hors forêt) ; hors-chemin seulement en forêt | bon ; garder |
| réserves, marais | hors-chemin interdit dans les marais ; dans les réserves **seulement si** « cueillette responsable » est cochée ; chemins autorisés (légal) | **règle fixe**, indépendante de l'affichage ; idem zones de tir |
| chasse | **non prise en compte** (seulement le message « vérifiez la chasse ») | les jours de battue (`huntArr`, déjà calculé), pas de hors-chemin dans les forêts hachurées et surcoût ×3 sur les chemins qui les traversent, avec message ; désactivable |
| zones de tranquillité de la faune, districts francs | absentes des données | à ajouter à `reserves.geojson` (données fédérales ouvertes, à vérifier : licence et poids) |

## 4. Principe commun : un « contrat » de contraintes
Toutes les propositions reposent sur la même règle d'architecture, qui corrige la cause du bug de fond :
1. **Un seul objet de réglages** et **un seul validateur** (`valide(tracé, réglages)` → liste des contraintes non tenues). Plus aucune vérification recopiée.
2. **Règles dures = réseau filtré** (difficulté technique, zones interdites) ; **ressources = étiquettes** (D+, D±, distance, durée) ; **préférences = coût** (forêt, zones colorées, routes, chasse hors battue, aléa).
3. **Monotonie garantie par repli** : si un réglage plus permissif n'aboutit pas, on relance avec le cran inférieur, dont le tracé est valide aussi pour le réglage demandé. Testé à chaque PR par `itineraires-monotonie.js`.
4. **Pas de budget en secondes** dans la décision : un nombre d'itérations fixe (la page reste réactive grâce au Web Worker ou aux pauses), donc même résultat sur tous les téléphones.

## 5. Propositions par vagues

Coût exprimé en % du quota hebdomadaire, sur la base de 2,5 % par 100 000 jetons, marge de 10 % comprise (2,75 % par 100 000 jetons), comme pour l'évaluation du 23 nov. Gains : mesurés quand c'est indiqué, sinon estimés.

| # | proposition | gain attendu | coût estimé |
|---|---|---|---|
| **A1** | **Réglages et validateur uniques** : un objet de réglages passé aux fonctions (fin des globales `BP`, `DV`, `NZ`, `OFFP`…), une fonction `valide()` utilisée partout, un préambule commun A→B / boucle / points de passage | fin des vérifications oubliées ; prérequis de tout le reste | ≈ 120 k · **3,3 %** |
| **A2** | **Difficulté = filtre** + détour et tout-terrain soumis à l'effort maximal (durée, D+) + **repli monotone** + test `itineraires-monotonie.js` dans l'Action des itinéraires | le bug « moyen OK, très difficile échoue » ne peut plus revenir ; le maximum « facile » est tenu (aujourd'hui dépassé 7 fois sur 8 en A→B, Riviera) | ≈ 60 k · **1,7 %** |
| **A3** | **Zones fixes** : réserves et zones de tir interdites au hors-chemin quoi que montre la carte ; chasse les jours de battue (hors-chemin interdit, chemins ×3, message) | tracés sûrs indépendamment de l'affichage | ≈ 50 k · **1,4 %** |
| **B1** | **Dénivelé et plafond exacts par étiquettes** (A→B, étapes), borne LARAC | tracé conforme trouvé chaque fois qu'il existe (mesuré : 52-58/60 → 60/60), tracé optimal (écart actuel jusqu'à 27-42 %) | ≈ 90 k · **2,5 %** |
| **B2** | **ALT** (8 repères sur une borne inférieure du coût) | plus courts chemins ≈ ×2 à ×3 plus rapides (mesuré ×3 sans bonus) ; surtout utile aux boucles | ≈ 50 k · **1,4 %** |
| **C1** | **Boucles par orienteering** : matrice départ + 40 meilleurs points, ILS à nombre d'itérations fixe, puis tronçons réels sous couloir ; ancien code derrière un interrupteur une version, comparaison par `itineraires-mesure.js` | boucles sous contraintes 10 s → ≈ 1 s (Riviera), longueur proche de la cible, même graine = même boucle sur tout téléphone ; retire `enrich`, `fill`, dichotomie et 2e passage | ≈ 220 k · **6,1 %** |
| **D1** | **Tout-terrain plus sobre** : dichotomie sur la force de récompense, un arbre réutilisé pour les étapes, 16 voisins | boucle tout-terrain 13 s → 4-6 s (Riviera, estimation), tracé hors chemin plus juste | ≈ 90 k · **2,5 %** |
| **D2** | **Web Worker** pour boucles et tout-terrain (proposition 10 du 23 nov.) | plus aucune page figée (blocs de 1,3 à 2,9 s mesurés) | ≈ 150 k · **4,1 %** |
| E1 | **Altitude filtrée** (hystérésis à la BRouter) dans `tools/graphe.py`, si une vérification montre un D+ gonflé | D+ affiché plus juste (à vérifier d'abord sur 5 parcours connus) | ≈ 40 k · **1,1 %** |

### Ordre conseillé
1. **Vague A, ≈ 6,4 %** (A1, A2, A3) : fiabilité et sécurité. A1 d'abord : sans lui, chaque nouvel algorithme devrait être branché à trois endroits.
2. **Vague B, ≈ 3,9 %** (B1, B2) : contraintes exactes, faible risque, gain mesuré.
3. **Vague C, ≈ 6,1 %** (C1) : la plus grosse amélioration des boucles, à faire après A et B (elle s'appuie sur le validateur, les étiquettes et ALT).
4. **Vague D, ≈ 6,6 %** (D1, D2) : tout-terrain et confort sur téléphone.
5. **Plus tard** : E1 après vérification sur le terrain.

Total des vagues A à C ≈ **16,4 %** du quota hebdomadaire ; A à D ≈ 23 %. Chaque vague : nouveau fil depuis `main` après fusion de la précédente, mesure avant / après avec `itineraires-mesure.js` et `itineraires-monotonie.js`, tests `tools/tests/itineraires*.test.js`.

## 6. Vague A réalisée (27 nov. 2026)
- **A1** : `valide(S, M, CAP, ref)` / `tenu(...)` remplacent les six copies de `okS`, `dvOk`, `capOver`, `lvl <= M` (A→B, points de passage, boucles, `enrich`, `fill`).
- **A2** : la difficulté est un filtre (pénalité 10⁶, puis ×40) ; repli monotone sur les niveaux plus stricts (M, M−1 … 0) pour A→B, points de passage et boucles ; le détour est retiré quand il fait dépasser la difficulté maximale ; test de monotonie ajouté à l'Action (0 violation sur `ple` et `gdv`).
- **A3** : le hors-chemin n'entre plus dans une réserve ni une zone de tir, quelles que soient les cases cochées (`usableTT`). Décision de Florian : **la chasse n'est pas évitée par le tracé**, l'avertissement affiché suffit.
- Limite connue : en A→B tout-terrain, « facile » donne encore parfois « moyen » (6 trajets sur 8 sur la Riviera) : la bande hors-chemin n'est pas encore soumise à l'effort maximal (vague D).
