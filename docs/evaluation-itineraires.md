# Évaluation des itinéraires découverte (23 nov. 2026)

Analyse seule, aucun changement de comportement. Périmètre : `itineraire.js` (782 lignes, 76 Ko) et le panneau `#sec-itin` de `index.html`, tels que livrés par les PR 120 à 144. Le blocage strict distance / durée (autre fil) n'est pas couvert.
Mesures : `node tools/profil/itineraires-mesure.js ple gdv` (Playwright, iPhone 13, CPU ralenti ×4 pour imiter un téléphone moyen, départ au centre de la fenêtre chargée, tirages à graine fixe).

## En bref
- **Le code fonctionne et il est testé** (7 tests Playwright sur les 8 régions), mais il s'est empilé par rustines : un seul fichier très dense, des réglages passés par variables globales, trois fonctions de calcul presque identiques.
- **Le problème principal, c'est le temps de calcul des boucles sur téléphone.** Une boucle simple prend 5 à 9 s, et la page est figée pendant ce temps. Avec une difficulté maximale ET une limite de dénivelé, il faut 57 à **130 s**. Une boucle tout-terrain fige la page jusqu'à **12,7 s** d'un bloc.
- **Bug réel : deux calculs peuvent se chevaucher.** Si l'on bouge un curseur pendant un calcul, un résultat périmé peut s'afficher en dernier (constaté : le message « Aucune boucle moyen » restait affiché alors que le curseur était sur « difficile »).
- **Les tracés A→B sont raisonnables** : +6 % de longueur en moyenne pour moins de hors-forêt, 10 % des trajets entre +27 et +30 %, au pire +55 à +91 %. Pour les boucles, il reste 2 à 12 % de tronçons parcourus deux fois. Avec une limite de dénivelé, la forêt peut tomber à 17 % du tracé.
- **Le panneau compte 14 réglages visibles d'un coup** : c'est trop pour un téléphone.

## 1. Qualité du code

| constat | où | conséquence |
|---|---|---|
| Réglages passés par variables globales modifiées puis remises à zéro dans `finally` (`BP`, `DV`, `OFFP`, `LFW`, `nf`, `VC`, `LOOPERR`, `noFit`) | `costs()`, `compute*()` | chevauchement de calculs (voir bug ci-dessous) ; fonctions impossibles à tester isolément |
| **Pas d'annulation** : chaque curseur relance `compute()` à chaque cran (`oninput`), sans attendre la fin du calcul précédent | `init()` l. 767-778 | calculs en double ou en triple, résultat périmé affiché, page figée en glissant un curseur |
| Trois fonctions jumelles `compute`, `computeLoop`, `computeWp` : même préambule (vue d'ensemble, déclaration, graphe, variétés, accord tout-terrain) et même double boucle « difficulté × dénivelé » recopiés | l. 555-670 | chaque nouvelle option doit être ajoutée trois fois (c'est ce qui s'est passé pour le dénivelé et le tout-terrain) |
| Formule de Tobler écrite 3 fois, conversion « point → maille » 8 fois, création de marqueur 3 fois, téléchargement de fichier 2 fois ; `setLFW` exporté deux fois, paramètre `keepSwallow` inutilisé, titre de section vide « bonus de cueillette » | partout | petites dérives possibles entre copies |
| `costs()` recalcule tout le tableau de coûts (toutes les arêtes de la région) **à chaque** plus court chemin, et `bonusQ()` reparcourt tous les échantillons de 25 m | l. 155-164, 136-143 | une boucle lance ≈ 1 000 plus courts chemins, avec le même recalcul à chaque fois |
| Boucles : 3 réglages de difficulté × 5 de dénivelé × 3 réductions de cible = **jusqu'à 30 recherches de boucle complètes** | `computeLoop` l. 569 | 130 s mesurées (Riviera, « facile » + D± ≤ 200 m) |
| Tout le calcul tourne sur le fil principal (pas de Web Worker) | — | page figée : jusqu'à 12,7 s d'un seul bloc |
| `Math.random()` dans l'ajustement du rayon des boucles | l. 269 | deux calculs identiques peuvent donner deux boucles différentes ; tests instables |
| Tests : 7 fichiers Playwright utiles (A→B, boucles, tout-terrain, météo, variétés, dénivelé, glisser), mais tirages au hasard sans graine, aucun lancement automatique (seule l'Action météo existe), aucun seuil de temps | `tools/tests/` | une lenteur comme les 130 s passe inaperçue |

Points solides : graphe compact précalculé, tas typé dans le tout-terrain, cache des dangers (`hazards`), règles métier bien commentées, documentation `docs/itineraires.md` à jour à chaque PR, messages d'échec explicites.

## 2. Mesures (téléphone simulé, CPU ×4)

| scénario | Riviera-Chablais (`ple`) | Gros-de-Vaud (`gdv`) |
|---|---|---|
| A→B par défaut | 28 ms | 26 ms |
| A→B « facile » + D+ ≤ 200 m | 0,2 s | 0,2 s |
| A→B tout-terrain, détour | 1,0 s (dont 6,5 km hors chemin sur 7,9 km) | 0,7 s (1,5 km hors chemin) |
| Boucle 8 km | 5,4 s (page figée par blocs de 1,6 s) | 7,9 s (blocs de 4,9 s) |
| Boucle 8 km « facile » + D± ≤ 200 m | **130 s**, et la limite n'est pas tenue au final | **57 s**, forêt 17 % du tracé |
| Boucle 6 km tout-terrain | **18 s**, bloc figé de 12,7 s | 14 s, bloc de 6,7 s |

Qualité A→B (60 trajets de 1,5 à 6 km, graine fixe) :

| | ple | gdv |
|---|---|---|
| longueur / plus court (pénalité hors forêt) : médiane · 90e centile · max | 1,00 · 1,30 · 1,55 | 1,02 · 1,27 · 1,63 |
| idem avec « grand détour » | 1,00 · 1,31 · 1,91 | 1,02 · 1,27 · 1,63 |
| part hors forêt (arêtes), sans → avec pénalité | 63 % → 55 % | 62 % → 51 % |
| plus court / ligne droite : médiane · max | 1,8 · 4,5 | 1,7 · 5,3 |
| tout-terrain : longueur en escalier / tracé lissé | +2,5 % (effet surtout visuel) | — |

Boucles : forêt 49 à 72 %, tronçons parcourus deux fois 2 à 12 % (21 % en tout-terrain sur `ple`). Les boucles « répétées » à paramètres identiques sont ici restées identiques, mais le code ne le garantit pas.

## 3. Propositions priorisées

Le coût est exprimé en % du quota hebdomadaire, sur la base de 2,5 % par 100 000 jetons, marge de 10 % comprise (soit 2,75 % par 100 000 jetons). Les gains annoncés sont estimés à partir des mesures ci-dessus. Ce sont des ordres de grandeur, pas des promesses.

| # | proposition | gain attendu | coût estimé |
|---|---|---|---|
| **1** | **Calcul unique et annulable** : un jeton de calcul (un calcul plus récent annule l'ancien), les curseurs ne relancent qu'au relâchement (`change`), et le rythme ne refait que l'affichage en A→B | supprime le bug du résultat périmé et les calculs en double | ≈ 50 k · **1,4 %** |
| **2** | **Contraintes des boucles bornées** : recherche par dichotomie au lieu du balayage complet (30 → ≤ 6 essais), budget de 3 s avec la meilleure boucle trouvée, aléatoire à graine fixe | 130 s → ≤ 10 s, résultats reproductibles | ≈ 70 k · **1,9 %** |
| **3** | **Coûts mis en cache** : tableau de coûts de base calculé une fois par jeu de réglages, pénalité de repassage appliquée seulement aux arêtes touchées, `bonusQ` gardé en mémoire ; pour les boucles, **un seul Dijkstra depuis le départ** pour choisir les étapes à la bonne distance *sur le réseau* (au lieu de 9 essais de rayon à vol d'oiseau) | boucles ≈ 5 à 10 fois plus rapides (5-8 s → environ 1 s) | ≈ 140 k · **3,9 %** |
| **4** | **Panneau en deux niveaux** : visible = type, A/B (ou départ + cible), Calculer ; replié = « Réglages » avec une ligne de résumé (« léger détour · ×1,5 · max moyen ») ; 3 préréglages (Balade facile, Cueillette, Sportif) | 14 réglages visibles → 4, meilleure prise en main sur téléphone | ≈ 90 k · **2,5 %** |
| **5** | **Retours visuels** : indicateur « Calcul… 2/5 » avec bouton Annuler ; résultat en une ligne + détails repliables (au lieu d'un long message concaténé) ; tronçons hors limite (difficulté, dénivelé) colorés sur la carte ; variantes de boucle avec forêt % et D+ | l'utilisateur comprend ce qui se passe et pourquoi le tracé ne respecte pas un réglage | ≈ 80 k · **2,2 %** |
| **6** | **Boucles moins d'allers-retours** : pénalité de repassage *spatiale* (couloir de 30 m, et non plus « même arête », car un chemin et une route parallèles à 10 m comptent aujourd'hui comme deux tracés différents) ; forme à 4 étapes testée en plus du triangle | répétitions 12 % → environ 5 % (`ple`), moins de « sucettes » au départ | ≈ 120 k · **3,3 %** |
| 7 | **Plafond de détour A→B** : longueur ≤ 1,35 × le plus court (1,6 × en « grand détour »), pénalités relâchées par paliers comme en tout-terrain | supprime les 5-10 % de trajets absurdes (jusqu'à +91 %) | ≈ 35 k · **1,0 %** |
| 8 | **Tout-terrain plus mesuré** : part hors chemin plafonnée selon le détour choisi (aujourd'hui 6,5 km sur 7,9 km possibles), tracé lissé (fin de l'escalier de 25 m) | tracés plus crédibles, moins de hors-chemin gratuit | ≈ 50 k · **1,4 %** |
| 9 | **Altitude dans le GPX et profil en long** dans la carte du résultat (MNT déjà chargé) | export utile dans les applications de randonnée, effort visible | ≈ 60 k · **1,7 %** |
| 10 | **Calcul dans un Web Worker** (boucles, tout-terrain) | plus aucun gel de la page, même à 10 s de calcul | ≈ 180 k · **5,0 %** |
| 11 | **Restructuration** : un objet de réglages passé aux fonctions au lieu des globales, un préambule commun et une seule fonction « essayer sous contraintes » pour A→B / boucle / points de passage, fichier découpé (réseau, boucles, tout-terrain, interface) | ajouts futurs 2 à 3 fois moins coûteux, moins de régressions | ≈ 220 k · **6,1 %** |
| 12 | **Tests automatiques** : graines fixes, seuils de temps (boucle < 3 s à CPU ×4), lancement par une Action GitHub sur chaque PR touchant `itineraire.js` | les lenteurs et régressions sont vues avant fusion | ≈ 50 k · **1,4 %** |

## 4. Ordre conseillé
1. **Vague 1, ≈ 4,7 %** : propositions 1, 2 et 12 (bug, 130 s, filet de tests). Faible risque, gain immédiat.
2. **Vague 2, ≈ 8,6 %** : propositions 3, 4 et 5 (vitesse et ergonomie).
3. **Vague 3, ≈ 5,7 %** : propositions 6, 7 et 8 (qualité des tracés), à mesurer avec `itineraires-mesure.js` avant et après.
4. **Plus tard** : propositions 9, 10 et 11. Le Web Worker (10) devient peu utile si la proposition 3 ramène les boucles vers 1 s. La restructuration (11) est à faire avant toute nouvelle option importante.

Total des trois premières vagues ≈ 19 % du quota hebdomadaire.
