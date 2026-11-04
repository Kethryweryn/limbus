---
id: ADR-0064
titre: Estimation générale du questionnaire : seuils, intervalle de la note moyenne, ordre des repères
statut: accepté
date: 2026-11-04
liens: [SPEC-015, ADR-0051, ADR-0061, ADR-0063]
---

# ADR-0064 : Estimation générale du questionnaire : seuils, intervalle de la note moyenne, ordre des repères

## Contexte

[ADR-0061](ADR-0061-indicateurs-du-questionnaire.md) a choisi deux mesures pour l'estimation générale de [SPEC-015](../specs/SPEC-015-qualite-du-questionnaire.md) (R13), et a laissé leurs seuils à choisir : la note obtenue dans l'affectation optimale, rapportée à la meilleure note possible, et la part des personnes dont la meilleure note est partagée.

Nos recherches n'ont trouvé aucun seuil publié pour ces deux mesures. La littérature sur l'affectation compare le bien-être obtenu à l'optimum (par exemple [Gao et Zhang, 2019](https://www.ijcai.org/proceedings/2019/41)), sans dire à partir de quelle valeur une affectation est bonne. Les bandes de Landis et Koch pour un indice corrigé du hasard sont [critiquées comme arbitraires](https://en.wikipedia.org/wiki/Cohen%27s_kappa). Le seuil de 15 % de Terwee, déjà écarté pour une échelle isolée (ADR-0063), signalerait même un questionnaire riche : voir ci-dessous.

ADR-0061 prévoit ce cas : sans seuil dans la littérature, le seuil est un choix de l'utilisatrice. Pour l'éclairer, une simulation (300 tirages par cas, réponses tirées au hasard) a mesuré les deux grandeurs sur des questionnaires types :

| Questionnaire | Personnes / rôles | Note moyenne | Ex æquo |
|---|---|---|---|
| Riche : 8 questions de 4 options, chaque option reliée à 2 personnages et 1 faction | 20 / 20 | 0,83 | 36 % |
| Moyen : 5 questions de 4 options, 1 personnage et 1 faction | 20 / 20 | 0,77 | 49 % |
| Riche, avec 80 % des réponses sur la même option | 20 / 20 | 0,65 | 35 % |
| Pauvre : 3 questions de 3 options, 1 personnage | 20 / 20 | 0,37 | 86 % |
| Factions seules : 6 questions de 4 options, 1 faction | 20 / 20 | 0,91 | 100 % |
| Riche | 5 / 20 | 0,97 | 35 % |
| Pauvre | 5 / 20 | 0,97 | 85 % |
| Riche | 40 / 20 | 0,88 | 36 % |

Ces chiffres dépendent des hypothèses de la simulation : ils situent les seuils, ils ne les démontrent pas.

## Décision

Ce qui suit complète ADR-0061 et remplace « à choisir au lot 3 » dans sa table.

### Note moyenne

- Le rapport se calcule pour chaque personne qui reçoit un rôle dans l'affectation optimale de l'assistant de casting, sans cadenas ni contraintes. Une personne dont la meilleure note est nulle n'entre pas dans l'affectation : elle n'a pas de rapport, et prendrait au hasard un rôle à une personne comptée, ce qui ferait dépendre la note de l'ordre des inscriptions.
- Bon à partir de 0,75 observé. Sous 0,60, « à revoir » si la borne haute de l'intervalle à 95 % reste sous 0,60, « à confirmer » sinon. Entre les deux, « à surveiller ». Choix de l'utilisatrice.
- Une personne sans rôle n'est pas comptée, car le manque de places n'est pas un défaut du questionnaire. Le détail dit combien de personnes sont dans ce cas.
- Tant que les personnes qui ont au moins un point sont moins nombreuses que les personnages PJ, la note est « à confirmer » quelle que soit sa valeur : chacune obtient presque toujours son meilleur personnage (0,97 dans la simulation, même pour un questionnaire pauvre). Comme pour « peu demandé » (R12), ce n'est pas un nombre choisi pour la fiabilité : sous ce nombre, les personnes ne se disputent pas encore les rôles.

### Ex æquo

- Une personne compte quand sa meilleure note est atteinte par plusieurs personnages. Une personne dont la meilleure note est nulle compte aussi, dès que le jeu a deux personnages : tous sont à égalité pour elle. Elle sort de la note moyenne, où le rapport n'a pas de sens.
- Bon jusqu'à une personne sur deux. Au-delà, « à revoir » si la borne basse de Wilson dépasse 50 %, « à confirmer » sinon. Choix de l'utilisatrice. Il sépare les questionnaires riche et moyen des questionnaires pauvre et factions seules.

### Intervalle de la note moyenne

L'intervalle de Wilson s'applique à la moyenne, avec le nombre de personnes comptées pour effectif. Le rapport de chaque personne est entre 0 et 1, donc x² ≤ x, et sa variance est au plus μ(1 − μ), celle d'une proportion de même moyenne ([Bhatia et Davis, 2000](https://doi.org/10.2307/2589180), avec m = 0 et M = 1). Wilson reste défini à 0 et à 1, là où un intervalle de Student aurait une largeur nulle dès que tout le monde obtient le même rapport.

Il est volontairement large. Il suppose aussi les personnes indépendantes, alors que l'affectation les lie entre elles : c'est un ordre de grandeur, à lire avec l'exigence de prudence d'ADR-0061, et non un intervalle exact.

### Niveau d'ensemble

Le niveau de l'estimation est le plus grave des deux mesures, dans l'ordre déjà utilisé pour les repères : à revoir, à confirmer, à surveiller, bon. Sans personne comptée pour la note, seuls les ex æquo le fixent.

### Ordre d'importance

Les repères se trient par niveau, puis du plus bloquant au moins bloquant pour le casting : personnage sans lien, personnages indistincts par les liens, puis chez les inscrits, question qui ne départage pas, échelle tassée, doublon de questions. Les repères de chaque niveau gardent cet ordre, et les autres restent dans leur ordre.

L'estimation renvoie à ces repères en tête de la liste plutôt que de les répéter.

### Calcul

L'affectation est `optimalAssignment`, la fonction qu'utilise `castingAssistant` (ADR-0051), sans cadenas, relations ni refus : les repères ne peuvent pas diverger de l'assistant, et réutilisent les notes déjà calculées. Rien n'est enregistré.

## Conséquences

- Une note « bon » ne demande que la valeur observée : avec peu de personnes placées, elle peut être flatteuse, mais la part des ex æquo et les repères détaillés restent lisibles à côté.
- Avec plus de personnes que de rôles, l'affectation place celles qui conviennent le mieux, et la note monte. En simulation, avec 20 rôles, le questionnaire riche passe de 0,83 (20 personnes) à 0,87 (30), 0,88 (40) et 0,91 (100) ; le pauvre reste à 0,36. Aucun niveau simulé ne change : la règle reste, par choix de l'utilisatrice.
- L'effectif de l'intervalle s'arrête au nombre de rôles. Sur un jeu à peu de rôles, une note basse peut rester « à confirmer » quel que soit le nombre d'inscrits, par exemple 0,37 avec 15 rôles : la phrase le dit, sans demander d'attendre.
- À total égal, plusieurs affectations peuvent exister, avec des rapports différents, entre personnes qui ont des points. La méthode hongroise en choisit une selon l'ordre des inscriptions. L'ampleur de cet écart n'a pas été mesurée.
- Un jeu qui relie ses questions aux factions seules reste « à revoir » pour ses ex æquo, même avec une bonne note. C'est voulu : les personnages d'une faction ne sont pas départagés.
- Les seuils n'ont pas de référence dans la littérature : leur fondement est le choix de l'utilisatrice, éclairé par la simulation. Ils pourront changer avec des données réelles, par la spec.

## Options écartées

- **Note corrigée du hasard (type kappa) avec les bandes de Landis et Koch** : bandes sans fondement, et plus difficile à expliquer à une équipe.
- **Seuil de 15 % de Terwee pour les ex æquo** : le questionnaire riche de la simulation en a 36 %.
- **Compter à zéro les personnes sans rôle** : la note baisserait dès qu'il y a plus d'inscrits que de rôles, même avec un très bon questionnaire.
- **Bootstrap pour la note** : des centaines d'affectations à chaque lecture, pour un intervalle de largeur nulle sur les petits effectifs où tout le monde obtient son maximum.
- **Exiger une borne pour « bon »** : avec 20 personnes, un questionnaire à 0,83 a une borne basse vers 0,6 : presque aucun jeu n'atteindrait « bon ».
