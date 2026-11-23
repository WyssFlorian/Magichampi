# Bouton « Les plus courants » (menu Champignons affichés)

Chaque catégorie (★ Stars, Bons, Intéressants) a un bouton qui coche uniquement les espèces les plus courantes de la
catégorie (les autres espèces de la catégorie sont décochées ; les autres catégories ne changent pas).

**Règle** : relevés SwissFungi dans le canton de Vaud, tous les relevés (somme des mois de `fungi[espèce].months`,
données de `vd/data.json` + `EXTRA_FUNGI`). Chaque relevé appartient à une seule espèce, donc aucun relevé n'est compté
deux fois. Une espèce est « la plus courante » si elle représente au moins **4 %** des relevés de sa catégorie.

| Catégorie | Relevés | Espèces retenues |
|---|---|---|
| ★ Stars | 16 602 | 8 : Girolle, Cèpe de Bordeaux, Chanterelle en tube, Cèpe d'été, Trompette des morts, Pholiote ridée, Morilles conique et blonde |
| Bons | 46 650 | 8 : Russule charbonnière, Meunier, Lactaire de l'épicéa, Russule olivacée, Bolet à pied rouge, Pied-de-mouton, Bolet bai, Pied bleu |
| Intéressants | 47 722 | 7 : Laccaire améthyste, Laccaire laqué, Vesse-de-loup perlée, Bolet blafard, Russule des épicéas, Bolet élégant, Hypholome à lames enfumées |

La liste est figée dans `index.html` (`COMMON_SP`, ~1 Ko) ; `python3 tools/plus_courants.py --write` la recalcule si
les espèces ou les relevés changent. Elle sert uniquement à la sélection : elle n'entre ni dans le score ni dans la
calibration. Le détail (relevés par espèce) s'affiche avec le bouton « i » à côté du bouton.
