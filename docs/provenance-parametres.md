# Provenance des paramètres du modèle (20.11.2026)

Un paramètre = une valeur, d'où elle vient, son type et la confiance qu'on peut lui accorder.

## Poids des facteurs (étape 2, calibrés sur données)
| Facteur | Poids | Origine | Confiance |
|---|---|---|---|
| Type de forêt (HAB) | 1 | valeurs à dire d'expert ; poids inchangé (la validation baisse de .64 à .55 sans lui) | moyenne |
| Essences (conifères / feuillus) | 0,2 | ajusté par validation croisée par blocs de 5 km (optimum 0 à 0,3) : double emploi avec le type de forêt | moyenne |
| Altitude | 0,6 | ajusté (optimum .5 à .6) : les trapèzes issus de SwissFungi sont trop sélectifs | moyenne |
| Peuplement, pente, humidité, sol | 1 | inchangés ; la pente reste (sans elle .639 → .617) | moyenne |
| SwissFungi (maille 5 km) | ×0,914 / ×0,83 (voisin / aucune) | exposant 1,15 sur 0,925 / 0,85 ; reflète aussi l'effort d'observation | moyenne |

Méthode : régression « présence contre fond groupe cible » (softmax conditionnel) sur 247 relevés précis (38 espèces, 3 cartes), poids bornés 0 à 3, régularisés vers 1, évalués par validation croisée à 5 plis par blocs de 5 km. Percentile (fond) hors échantillon : .590 → .647. Avertissement : les relevés viennent surtout d'iNaturalist (biais de prospection), et la plupart des espèces ont moins de 30 relevés : les poids sont globaux, pas par espèce.

## Paramètres par espèce
Type : **donnée** = tiré de relevés SwissFungi, **expert** = estimation à dire d'expert (à vérifier), **mixte**. Fiabilité faible si moins de 30 relevés précis ou marque « weak » dans le code.

| Espèce | Palier | Relevés précis | Percentile (rang parmi forêts) | Hôte (expert) | Altitude optimum m (donnée SwissFungi, p10-p90) | Température °C (expert) | Gel (expert) | Sol (expert) | Fiabilité |
|---|---|---|---|---|---|---|---|---|---|
| Cèpe de Bordeaux | 1 | 11 | 0.75 | feuillus et résineux | 602–1424 | 3/9/17/24 | 0.7 | acide (k 0.15) | faible |
| Cèpe d'été | 1 | 6 | 0.78 | feuillus | 460–1099 | 9/13/22/28 | 0.6 | indiff. (k 0) | faible |
| Cèpe des pins | 1 | 1 | 0.70 | résineux | 534–1523 | 3/8/16/22 | 0.7 | acide (k 0.3) | faible |
| Girolle | 1 | 0 | – | feuillus et résineux | 558–1453 | 7/11/20/26 | 0.7 | acide (k 0.3) | faible |
| Trompette des morts | 1 | 21 | 0.73 | feuillus | 570–730 | 3/8/17/23 | 0.75 | calcaire (k 0.3) | faible |
| Chanterelle en tube | 1 | 12 | 0.62 | résineux | 590–1256 | 0/4/13/19 | 0.88 | acide (k 0.3) | faible |
| Morille conique | 1 | 0 | – | indifférent | 568–1339 | 4/8/15/20 | 0.85 | calcaire (k 0.15) | faible |
| Morille blonde | 1 | 1 | 0.91 | feuillus | 432–880 | 5/9/16/21 | 0.85 | calcaire (k 0.3) | faible |
| Tricholome de la Saint-Georges | 1 | 1 | 0.91 | indifférent | 400–1078 | 5/9/15/20 | 0.85 | calcaire (k 0.3) | faible |
| Pied-de-mouton | 2 | 1 | 0.90 | feuillus et résineux | 530–1213 | 2/7/16/22 | 0.8 | calcaire (k 0.15) | faible |
| Bolet bai | 2 | 17 | 0.78 | résineux | 590–1109 | 3/8/16/22 | 0.75 | acide (k 0.3) | faible |
| Pied bleu | 2 | 0 | – | feuillus et résineux | 430–953 | 0/4/12/18 | 0.9 | indiff. (k 0) | faible |
| Coulemelle | 2 | 9 | 0.55 | indifférent | 562–940 | 5/9/18/24 | 0.7 | indiff. (k 0) | faible |
| Lactaire délicieux | 2 | 0 | – | résineux | 430–1175 | 5/9/17/22 | 0.75 | calcaire (k 0.15) | faible |
| Chanterelle jaune | 2 | 2 | 0.79 | résineux | 536–1462 | 2/6/15/20 | 0.85 | calcaire (k 0.15) | faible |
| Clitocybe géotrope | 2 | 9 | 0.52 | feuillus | 422–1357 | 3/7/15/20 | 0.85 | calcaire (k 0.2) | faible |
| Sparassis crépu | 2 | 0 | – | résineux | 430–670 | 6/10/18/24 | 0.7 | acide (k 0.15) | faible |
| Russule verdoyante | 2 | 0 | – | feuillus | 479–852 | 10/14/22/27 | 0.6 | acide (k 0.15) | faible |
| Meunier | 2 | 7 | 0.44 | feuillus et résineux | 454–1316 | 5/10/18/24 | 0.75 | indiff. (k 0) | faible |
| Coprin chevelu (jeune) | 2 | 34 | 0.54 | indifférent | 350–1100 | 6/10/18/23 | 0.8 | indiff. (k 0) | faible |
| Russule charbonnière | 2 | 3 | 0.86 | feuillus | 580–945 | 7/11/20/26 | 0.7 | indiff. (k 0) | faible |
| Laccaire améthyste | 3 | 23 | 0.70 | feuillus et résineux | 550–1250 | 4/8/17/22 | 0.8 | acide (k 0.15) | faible |
| Pleurote en huître | 2 | 5 | 0.52 | feuillus | 398–710 | -2/3/12/18 | 1 | indiff. (k 0) | faible |
| Bolet à pied rouge | 2 | 6 | 0.72 | feuillus et résineux | 567–1410 | 6/10/19/24 | 0.7 | acide (k 0.15) | faible |
| Pholiote du peuplier | 2 | 1 | 0.68 | feuillus | 330–650 | 8/12/22/27 | 0.7 | indiff. (k 0) | faible |
| Gomphide glutineux | 2 | 3 | 0.80 | résineux | 780–1700 | 4/8/16/22 | 0.8 | acide (k 0.15) | faible |
| Laccaire laqué | 3 | 1 | 0.07 | feuillus et résineux | 500–1500 | 4/8/17/22 | 0.8 | acide (k 0.15) | faible |
| Laccaire à deux couleurs | 3 | 0 | – | résineux | 750–1700 | 3/7/16/21 | 0.85 | acide (k 0.3) | faible |
| Lépiste sordide | 3 | 0 | – | indifférent | 400–900 | 2/6/15/20 | 0.85 | calcaire (k 0.15) | faible |
| Mélanoleuque gris et blanc | 3 | 0 | – | indifférent | 450–1200 | 3/7/17/22 | 0.8 | indiff. (k 0) | faible |
| Tricholome en touffes | 3 | 9 | 0.73 | feuillus | 420–900 | 5/9/18/23 | 0.75 | indiff. (k 0) | faible |
| Cortinaire varié | 3 | 2 | 0.85 | épicéa | 850–1700 | 3/7/15/20 | 0.8 | calcaire (k 0.3) | faible |
| Cortinaire remarquable | 3 | 4 | 0.68 | feuillus | 520–850 | 5/9/17/22 | 0.75 | calcaire (k 0.3) | faible |
| Hypholome à lames enfumées | 3 | 3 | 0.23 | résineux | 830–1600 | 0/4/14/20 | 0.9 | acide (k 0.15) | faible |
| Armillaire d'Ostoya | 3 | 6 | 0.47 | résineux | 510–1340 | 4/8/16/21 | 0.8 | indiff. (k 0) | faible |
| Lépiote mamelonnée | 3 | 1 | 0.48 | indifférent | 550–850 | 5/9/18/24 | 0.7 | calcaire (k 0.15) | faible |
| Russule vieux rose | 3 | 4 | 0.89 | feuillus | 500–1000 | 9/13/21/26 | 0.65 | acide (k 0.15) | faible |
| Russule dorée | 3 | 3 | 0.86 | feuillus | 520–1150 | 10/14/22/27 | 0.6 | calcaire (k 0.15) | faible |
| Russule de Turco | 3 | 0 | – | résineux | 600–1500 | 5/9/17/22 | 0.75 | acide (k 0.15) | faible |
| Russule vineuse | 3 | 0 | – | épicéa | 850–1600 | 4/8/16/21 | 0.8 | acide (k 0.3) | faible |
| Russule orangée grisonnante | 3 | 1 | 0.75 | résineux | 1000–1900 | 3/7/15/20 | 0.85 | acide (k 0.3) | faible |
| Russule des marais | 3 | 1 | 0.75 | résineux | 950–1700 | 3/7/15/20 | 0.85 | acide (k 0.3) | faible |
| Russule belette | 3 | 0 | – | épicéa | 950–1700 | 3/7/15/20 | 0.85 | acide (k 0.15) | faible |
| Russule des épicéas | 3 | 1 | 0.95 | épicéa | 780–1650 | 3/7/16/21 | 0.8 | calcaire (k 0.15) | faible |
| Chanterelle violette | 3 | 0 | – | résineux | 800–1400 | 5/9/17/22 | 0.75 | calcaire (k 0.3) | faible |
| Hydne imbriqué | 3 | 2 | 0.94 | épicéa | 930–1630 | 3/7/15/20 | 0.8 | acide (k 0.15) | faible |
| Polypore en ombelle | 3 | 4 | 0.65 | feuillus | 450–950 | 10/14/22/26 | 0.65 | calcaire (k 0.15) | faible |
| Bolet des bouviers | 3 | 0 | – | résineux | 500–1100 | 5/9/17/22 | 0.75 | acide (k 0.3) | faible |
| Bolet élégant | 3 | 14 | 0.35 | résineux | 850–1900 | 6/10/18/23 | 0.75 | calcaire (k 0.15) | faible |
| Bolet gris des mélèzes | 3 | 7 | 0.52 | résineux | 800–1900 | 6/10/18/23 | 0.75 | calcaire (k 0.15) | faible |
| Nonnette voilée | 3 | 0 | – | résineux | 500–1300 | 6/10/18/23 | 0.75 | indiff. (k 0) | faible |
| Bolet blafard | 3 | 11 | 0.66 | feuillus | 510–1270 | 9/13/21/26 | 0.65 | calcaire (k 0.3) | faible |

## Sources scientifiques à consulter (non encore lues en détail : à confirmer avant de les citer dans l'app)
Trouvées le 20.11.2026 par recherche web ; seuls les titres ont été vus, pas le texte complet.
- Décalage des pics de fructification en altitude dans les Alpes (« Altitudinal upwards shifts in fungal fruiting in the Alps », PubMed 31964234) : à utiliser pour caler le décalage de saison (aujourd'hui 7 jours par 250 m, hypothèse unique pour toutes les espèces).
- « Unraveling environmental drivers of a recent increase in Swiss fungi fruiting » (Université de Berne, boris-portal.unibe.ch) : température et précipitations comme moteurs de la fructification en Suisse.
- PMC7015340 et PMC3437857 (PubMed Central) : articles sur la phénologie de fructification et le climat, titres non vérifiés.
- Andrew et al. 2018, Ecology : fructification et climat, comparaison de la fenêtre de pluie.
- Déjà citées par l'expertise externe (existence vérifiée, détails non) : Hao et al. 2020 ; Kauserud et al. 2008 ; Barbet-Massin et al. 2012 ; Büntgen et al.

## Ce qui reste (étape 3 et suite)
- Réserve en eau du sol OFAG (remplace les 60 mm fixes) : jeu de données à télécharger, pas encore intégré.
- Carte WSL 10 m des essences : tâche séparée à valider par Florian ; devrait réduire le double emploi essences / type de forêt constaté ici.
- Calibration par espèce : impossible avec moins de 30 relevés (une seule espèce, le coprin chevelu, en a davantage). À refaire quand les relevés « coins partagés » seront disponibles.
- Décalage de saison et plages de température : à caler avec les dates des relevés et les grilles MétéoSuisse (non fait ici).
