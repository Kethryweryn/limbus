---
id: ADR-0063
titre: Repères sur les réponses : extrémité d'une échelle, test du V de Cramér, risque d'erreur
statut: accepté
date: 2026-11-04
liens: [SPEC-015, ADR-0061]
---

# ADR-0063 : Repères sur les réponses : extrémité d'une échelle, test du V de Cramér, risque d'erreur

## Contexte

[ADR-0061](ADR-0061-indicateurs-du-questionnaire.md) a choisi les indicateurs de [SPEC-015](../specs/SPEC-015-qualite-du-questionnaire.md). En préparant le lot 2, trois points se sont révélés incomplets :

- le seuil de 15 % de Terwee et al. (2007) porte sur le score d'une mesure. Sur une seule échelle de 1 à 5, une répartition égale met déjà 20 % à chaque extrémité : presque toutes les échelles seraient signalées ;
- ADR-0061 demande de juger chaque paire sur une valeur p contre le seuil, sans dire laquelle pour le V de Cramér ;
- il ne fixe pas le risque d'erreur du test unilatéral.

## Décision

Ce qui suit complète ADR-0061 et remplace sa ligne « Échelle tassée à une extrémité » pour le seuil.

### Extrémité d'une échelle (R9)

Le seuil est de 20 %, la part d'une note dans une répartition égale entre les 5 notes (choix de l'utilisatrice). L'échelle est « à revoir » quand la borne basse de Wilson de l'extrémité dépasse 20 %. Ce n'est plus le critère de Terwee : les études qui appliquent un seuil à une question isolée vont de 15 % à 40 %, sans norme commune.

### Test du V de Cramér (R10)

Le seuil « fort » de Cohen, 0,50 / √df\*, revient à w = 0,50 quel que soit le tableau. La valeur p teste « l'association dépasse ce seuil » par la loi du khi-deux non centrale, avec le paramètre de non-centralité λ₀ = 0,25 n, à (r−1)(c−1) degrés de liberté. C'est la loi qui sert à construire l'intervalle de confiance du V (Smithson, 2003).

Une paire est « à revoir » quand le V corrigé atteint le seuil, que les conditions de Cochran sont remplies et que la valeur p ajustée confirme. Si le V corrigé atteint le seuil sans le reste, elle est « à confirmer ». Sous le seuil, elle n'est pas affichée (choix de l'utilisatrice) : une ligne par paire de questions noierait les autres repères.

Le nombre de lignes et de colonnes est celui des réponses données par les personnes de la paire, car une option que personne n'a choisie n'a pas d'effectif attendu.

### Risque d'erreur

Le seuil des valeurs p unilatérales est de 0,025 : avec une seule paire, le test donne la même conclusion que la borne basse d'un intervalle à 95 %. Après la correction de Holm, le risque de signaler à tort au moins une paire reste sous 2,5 %, donc sous les 5 % d'ADR-0061.

Toutes les paires testées entrent dans la correction, y compris celles sous le seuil. R10 et R11 forment deux familles séparées.

### Corrélations extrêmes

Avec 3 réponses ou moins, la transformation de Fisher n'a pas d'erreur type, et une corrélation y vaut souvent 1 par simple hasard : la paire n'est pas affichée (choix de l'utilisatrice). C'est la limite du calcul, et non un nombre minimal choisi à la main. Une corrélation de 1 a une valeur p nulle à partir de 4 réponses, comme dans les logiciels de statistique.

### Calcul

Les fonctions statistiques (loi normale, khi-deux central et non central, Wilson, Holm, corrélations) sont écrites dans `utils/statistics.ts`, sans nouvelle dépendance, et testées contre des valeurs de référence de SciPy.

## Conséquences

- Une échelle bien répartie n'est plus signalée. Une extrémité un peu au-dessus de 20 % reste « à confirmer » sur un petit effectif, ce qui se résout avec plus de réponses.
- Le test du V est exigeant : sur un petit jeu, un doublon restera souvent « à confirmer ».
- Le seuil de 20 % n'a pas de référence dans la littérature : son fondement est le calcul de la répartition égale.

## Options écartées

- **Garder 15 %** : signale des échelles bien réparties.
- **Retirer le repère d'extrémité** : une échelle où 60 % des personnes donnent 5 ne serait plus signalée, alors qu'elle sépare mal.
- **Tester l'indépendance plutôt que le seuil** : un lien faible mais certain passerait le test ; il ne dit pas que la question fait doublon.
- **Bibliothèque de statistiques** : une dépendance de plus pour quelques fonctions courtes, faciles à vérifier.
