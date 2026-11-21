# Provenance des paramètres du modèle (20.11.2026)

Un paramètre = une valeur, d'où elle vient, son type et la confiance qu'on peut lui accorder.

## Poids des facteurs (étape 2, calibrés sur données)
| Facteur | Poids | Origine | Confiance |
|---|---|---|---|
| Type de forêt (HAB) | 1 | valeurs à dire d'expert ; poids inchangé (la validation baisse de .64 à .55 sans lui) | moyenne |
| Essences (part de conifères) | 0,1 (0,05 quand le type de forêt est connu) | ajusté à 0,2 par validation croisée (blocs de 5 km), ramené à 0,1 à l'arrivée de la carte WSL ; sans effet mesurable entre 0 et 0,2 (rapport de méthode, 10.3) | faible |
| Essence dominante WSL | ×1,6 (hôtes étroits), ×1,2 (feuillus précis), ×0,4 (généralistes) | voir plus bas ; la russule des épicéas (integra) est volontairement dans le groupe des généralistes : elle accompagne aussi les pins | moyenne |
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
| Tricholome de la Saint-Georges | 2 | 1 | 0.91 | indifférent | 400–1078 | 5/9/15/20 | 0.85 | calcaire (k 0.3) | faible |
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
- Calibration par espèce : impossible avec moins de 30 relevés (une seule espèce, le coprin chevelu, en a davantage). À refaire quand les relevés « coins partagés » seront disponibles.
- Décalage de saison et plages de température : à caler avec les dates des relevés et les grilles MétéoSuisse (non fait ici).

## Carte WSL 10 m des essences (20.11.2026)
- Source : Koch, Hobi, Morsdorf, Waser (2024), EnviDat, DOI 10.16904/envidat.506 (accès sur demande, ≈ 76 % de précision, validée seulement sur ses données d'entraînement). Couche `wsl` des tuiles : classe majoritaire par cellule de 25 m (`tools/wsl_vers_tuiles.py`), 0 = inconnu.
- Usage : 33 espèces à hôtes nommés (17 hôtes étroits (groupe N), 10 feuillus précis (B), 6 généralistes (G)) (`WSL_HOSTS`) ; facteur 1 si l'essence dominante est un hôte, 0,6 si même type (feuillu/résineux), 0,3 sinon, écart réduit pour hêtre et épicéa (×0,6 au lieu de ×0,8) ; inconnu = moyenne de l'espèce sur la région ; puissance W_WSL = 0,4, part de résineux W_HOST 0,2 → 0,1.
- Validation sur les 247 relevés précis (rang moyen, 0,5 = hasard) : 0,639 → 0,654 (+0,015, IC 95 % par blocs de 5 km [+0,005 ; +0,025]) ; Boyce 0,99 → 0,99. Par carte : ple 0,708 → 0,720 ; lsn 0,586 → 0,603 ; gdv 0,660 → 0,67. W_WSL seul (sans baisser W_HOST) : +0,008, IC [0 ; +0,015]. W_HOST 0 : +0,022 mais Boyce 0,96, non retenu.
- Seuils de classes recalculés (`MAP_THR_V6`, `tools/seuils.js`).
- **Affinage (20.11.2026, 2)** : trois groupes de puissance (N hôtes étroits pins/épicéa/sapin : 1,6 ; B feuillus précis : 1,2 ; généralistes : 0,4), hôte à moins de 50 m (anneaux de 25 et 50 m) compté 0,9 au lieu de la seule cellule, hôtes ajoutés pour Russule des marais, Russule orangée grisonnante et Laccaire à deux couleurs. Pas d'exclusion dure : la pire cellule perd au plus ≈ 70 % pour un hôte étroit (0,44^1,6), jamais 100 %. Les mélèzes ne sont pas dans la carte WSL : Bolet élégant et Bolet gris des mélèzes restent sans facteur essence.
  Validation (247 relevés, rang moyen) : 0,654 → 0,656 ; ple 0,721 → 0,729, lsn 0,602 → 0,603, gdv 0,674 → 0,674 ; Boyce 0,993 → 0,990. Essais en grille (puissance N 0,4 à 2,4, B 0,4 à 1,6, voisinage 0,7 à 0,9) : tous entre 0,653 et 0,656, plateau. **Gain statistiquement négligeable** : trop peu de relevés par espèce (< 30) pour trancher ; la pénalité plus forte est cohérente avec l'écologie mais n'est pas prouvée par les relevés. Seuils V6 recalculés pour les 8 régions.
- Droit d'usage commercial de la carte WSL : pas encore demandé.

Note (20.11.2026) : le malus de sol maximal est k·|p| (k = 0,15 ou 0,3, p = préférence de l'espèce entre −1 et 1), donc 7,5 % pour p = ±0,5 et k = 0,15, et non k. Pour les hôtes, la valeur « même type » de l'essence WSL est définie par rapport au premier hôte de la liste de l'espèce.

## Ajout de 34 espèces bonnes comestibles (21.11.2026)
Demande de Florian : ajouter les bons comestibles présents dans le canton de Vaud et la Veveyse, repérés dans SwissFungi (plus de 320 relevés en Suisse, 658 espèces), hors prairies et pelouses, hors espèces de la liste rouge suisse (Senn-Irlet et al. 2007, vérifiée sur le PDF complet). L'évaluation comestible / non comestible des 658 espèces est un travail à dire d'expert, non revu par la VAPKO.
- Écartées pour la liste rouge : Lactaire à lait rouge sang (NT), Bolet orangé (le Leccinum des chênes est VU, celui du bouleau NT : les relevés ne distinguent pas), Russule jaune claire (VU), Oronge (VU), Hygrophore de mars (NT).
- Pas revérifié pour ces 34 espèces : l'annexe 2 du règlement vaudois (RLPrPNP). Les 45 espèces d'origine avaient été contrôlées.
- Relevés SwissFungi : ensemble de données SwissFungi/WSL (GBIF), un enregistrement par identifiant ; doublons (même lieu, même date, même récolteur) écartés ; aucune espèce n'avait de doublon. Mailles de 5 km (`EXTRA_FUNGI`), mois (toute la Suisse), altitude (relevés VD + Veveyse, ou toute la Suisse s'il y en a moins de 40).
- Seuils de classes recalculés pour les 8 régions (`tools/seuils.js`, `MAP_THR_V6`) ; ceux des 45 espèces d'origine n'ont pas bougé (vérifié région par région).
- Validation : seulement 20 relevés précis indépendants (GBIF hors SwissFungi, incertitude ≤ 100 m, sans doublon) tombent en forêt dans la carte, pour 8 de ces espèces : rang moyen 0,65 sur 17 relevés en forêt. C'est trop peu pour juger une espèce : toutes sont donc marquées « fiabilité faible » dans ce tableau, et 11 portent en plus la mention « weak » dans le code (bois mort, prairies, peu de relevés précis, essences mal repérées).
- Paliers : 3 « Stars » (Pholiote ridée, Chanterelle améthyste, Cèpe appendiculé), 15 « Bons comestibles », 16 « Comestibles intéressants » (comestibles corrects, bois mort ou jeunes seulement). Choix à dire d'expert, modifiable.
- Russule verdoyante : retirée le 20.11 pour moins de 450 relevés ; elle a 431 relevés en Suisse, donc plus de 320, et est de retour.

| Espèce | Palier | Relevés précis | Percentile (rang parmi forêts) | Hôte (expert) | Altitude optimum m (donnée SwissFungi, p10-p90) | Température °C (expert) | Gel (expert) | Sol (expert) | Fiabilité |
|---|---|---|---|---|---|---|---|---|---|
| Pholiote ridée | 1 | 0 | – | résineux | 580–1440 | 5/9/17/22 | 0.8 | acide (k 0.3) | faible |
| Chanterelle améthyste | 1 | 0 | – | feuillus et résineux | 570–1371 | 7/11/19/24 | 0.7 | acide (k 0.15) | faible |
| Cèpe appendiculé | 1 | 0 | – | feuillus | 453–1360 | 9/13/22/27 | 0.6 | calcaire (k 0.3) | faible |
| Lactaire à lait abondant | 2 | 0 | – | feuillus et résineux | 528–1210 | 8/12/21/26 | 0.65 | acide (k 0.15) | faible |
| Russule à odeur de crabe | 2 | 0 | – | feuillus et résineux | 671–1525 | 6/10/18/23 | 0.75 | acide (k 0.15) | faible |
| Russule olivacée | 2 | 0 | – | feuillus et résineux | 541–1530 | 7/11/20/25 | 0.7 | calcaire (k 0.15) | faible |
| Russule verdoyante | 2 | 1 | 0.19 | feuillus | 480–848 | 10/14/22/27 | 0.6 | acide (k 0.15) | faible |
| Russule changeante | 2 | 0 | – | feuillus | 578–890 | 8/12/20/25 | 0.7 | indiff. (k 0) | faible |
| Bolet rude (bouleau) | 2 | 0 | – | feuillus | 430–1049 | 7/11/19/24 | 0.7 | acide (k 0.3) | faible |
| Bolet pulvérulent | 2 | 0 | – | feuillus et résineux | 383–720 | 10/14/22/27 | 0.6 | acide (k 0.15) | faible |
| Chanterelle orangée | 2 | 0 | – | résineux | 579–880 | 7/11/19/24 | 0.7 | acide (k 0.3) | faible |
| Chanterelle ondulée | 2 | 0 | – | feuillus et résineux | 488–891 | 7/11/18/23 | 0.75 | indiff. (k 0) | faible |
| Pied-de-mouton roussâtre | 2 | 0 | – | feuillus et résineux | 505–1495 | 2/7/16/22 | 0.8 | calcaire (k 0.15) | faible |
| Tricholome à odeur d’iris | 2 | 0 | – | indifférent | 476–2050 | 2/6/14/19 | 0.85 | calcaire (k 0.15) | faible |
| Pied bleu glauque | 2 | 0 | – | feuillus et résineux | 430–1050 | 0/4/12/18 | 0.9 | indiff. (k 0) | faible |
| Pleurote tardif | 2 | 2 | 0.56 | feuillus | 430–862 | -3/2/10/15 | 1 | indiff. (k 0) | faible |
| Polypore des brebis | 2 | 0 | – | résineux | 651–1620 | 3/7/15/20 | 0.8 | indiff. (k 0) | faible |
| Morille veinée | 2 | 0 | – | indifférent | 390–820 | 4/8/15/20 | 0.85 | calcaire (k 0.15) | faible |
| Russule à pied violet | 3 | 0 | – | feuillus et résineux | 575–905 | 9/13/21/26 | 0.65 | indiff. (k 0) | faible |
| Gomphide rutilant | 3 | 0 | – | résineux | 430–1240 | 5/9/17/22 | 0.75 | acide (k 0.3) | faible |
| Gomphide helvétique | 3 | 0 | – | résineux | 560–1642 | 3/7/15/20 | 0.8 | acide (k 0.15) | faible |
| Gomphide taché | 3 | 0 | – | résineux | 584–1685 | 4/8/16/21 | 0.8 | acide (k 0.15) | faible |
| Hygrophore à odeur d'amande | 3 | 0 | – | résineux | 547–1520 | 2/6/14/19 | 0.85 | calcaire (k 0.15) | faible |
| Hygrophore pustuleux | 3 | 0 | – | résineux | 540–1408 | 0/4/12/17 | 0.9 | calcaire (k 0.15) | faible |
| Hygrophore des mélèzes | 3 | 0 | – | résineux | 494–1343 | 0/4/11/16 | 0.9 | indiff. (k 0) | faible |
| Langue de bœuf | 3 | 1 | 0.74 | feuillus | 399–671 | 9/13/21/26 | 0.65 | acide (k 0.15) | faible |
| Armillaire couleur de miel | 3 | 2 | 0.05 | indifférent | 421–891 | 4/8/16/21 | 0.8 | indiff. (k 0) | faible |
| Polypore écailleux | 3 | 0 | – | feuillus | 380–890 | 4/8/17/22 | 0.8 | indiff. (k 0) | faible |
| Polypore géant | 3 | 3 | 0.84 | feuillus | 426–811 | 8/12/20/25 | 0.7 | indiff. (k 0) | faible |
| Oreille de Judas | 3 | 5 | 0.81 | feuillus | 394–660 | -4/2/12/18 | 1 | indiff. (k 0) | faible |
| Vesse-de-loup perlée | 3 | 2 | 0.74 | indifférent | 509–1449 | 6/10/18/24 | 0.75 | indiff. (k 0) | faible |
| Agaric des forêts | 3 | 1 | 0.82 | feuillus et résineux | 480–1460 | 8/12/20/25 | 0.7 | indiff. (k 0) | faible |
| Agaric sylvatique | 3 | 0 | – | résineux | 456–1250 | 6/10/18/23 | 0.75 | acide (k 0.15) | faible |
| Agaric des bois | 3 | 0 | – | feuillus et résineux | 488–1275 | 7/11/19/24 | 0.7 | indiff. (k 0) | faible |
