---
id: ADR-0061
titre: Indicateurs statistiques de la qualité du questionnaire de casting
statut: accepté
date: 2026-11-03
liens: [SPEC-015, SPEC-001, ADR-0050, ADR-0051]
---

# ADR-0061 : Indicateurs statistiques de la qualité du questionnaire de casting

## Contexte

[SPEC-015](../specs/SPEC-015-qualite-du-questionnaire.md) donne à l'équipe d'un jeu des repères sur son questionnaire de casting. Il faut des indicateurs reconnus, valables sur de petits effectifs (un GN compte souvent de 20 à 60 inscrits), et qui disent quand les réponses ne suffisent pas encore pour conclure. Les seuils doivent venir de la littérature quand elle en donne, et des choix de l'utilisatrice sinon.

## Décision

### Calcul

- Les repères se calculent à la lecture, sans rien enregistrer, par une route `GET /api/games/:id/registration-form-quality` protégée par `requireGameAccess`.
- Les calculs sont des fonctions pures dans `utils/questionnaireQuality.ts`, testées à l'unité. Elles reprennent la note de l'assistant de casting (`castingScore`, `answerFactor`) et son affectation optimale (`hungarian`, `utils/castingAssistant.ts`).
- Chaque repère rend un niveau (`good`, `watch`, `review`, `unsure`), les comptes de sa phrase, la valeur de l'indicateur, son seuil et sa référence. L'interface rédige la phrase.

### Indicateurs

| Repère | Indicateur | Seuil | Référence |
|---|---|---|---|
| Personnages indistincts par les liens (R6) | Similarité cosinus des profils de points (points donnés par chaque option, échelle comptée à 5/5) | 0,80, choix de l'utilisatrice (« 8 points sur 10 en commun ») | — |
| Question qui ne départage pas (R8) | Part de la réponse la plus choisie (ou de chaque option d'une question à choix multiples), intervalle de Wilson à 95 % ; en détail, pour une question à choix unique ou une échelle, entropie normalisée (entropie de Shannon divisée par le logarithme du nombre d'options) | 0,8, choix de l'utilisatrice | Wilson (1927), recommandé pour les petits effectifs par Brown, Cai et DasGupta (2001) ; Dahl et Østerås (2010) pour l'entropie normalisée |
| Échelle tassée à une extrémité (R9) | Part des réponses au minimum et au maximum, intervalle de Wilson ; en détail, dispersion ordinale de Leik | 15 % | Terwee et al. (2007), effets plancher et plafond ; Leik (1966) |
| Doublon entre questions à choix (R10) | V de Cramér corrigé du biais | Seuil « fort » de Cohen : 0,50 / √df\*, avec df\* le plus petit nombre d'options moins un | Bergsma (2013) ; Cohen (1988). Les seuils de Cohen portent sur l'association dans la population ; le V corrigé en est un meilleur estimateur que le V brut, qui la surestime sur un petit effectif. Le comparer au seuil est donc plus prudent, au prix de quelques doublons faibles manqués. |
| Doublon entre échelles (R10) | Corrélation de Spearman, intervalle par la transformation de Fisher avec l'erreur type de Bonett et Wright (√(1,06/(n−3))) | 0,50 | Clark et Watson (1995) : corrélations entre questions de 0,15 à 0,50 ; Bonett et Wright (2000) pour l'intervalle |
| Personnages indistincts chez les inscrits (R11) | Corrélation de Pearson des notes, intervalle par la transformation de Fisher | 0,85 | Henseler, Ringle et Sarstedt (2015), critère HTMT, seuil prudent |
| Personnages peu ou trop demandés (R12) | Comptes : présence parmi les 3 meilleurs, meilleur personnage | moins de 2 ; plus de 3 (choix de l'utilisatrice) ; « peu demandé » affiché seulement à partir de réponses aussi nombreuses que la moitié des personnages PJ (choix de l'utilisatrice) | — |
| Estimation générale (R13) | Affectation optimale : note obtenue rapportée à la meilleure possible ; part des meilleures notes ex æquo, intervalle de Wilson | à choisir au lot 3 | Kuhn (1955), méthode hongroise |

### Fiabilité

Aucun nombre minimal de réponses n'est fixé, sauf pour « peu demandé » (R12), un simple compte qu'aucun test ne juge. Un repère passe à « à revoir » quand la borne de son intervalle à 95 % qui va dans le sens prudent franchit le seuil. Quand seule la valeur observée le franchit, il est « à confirmer ». Pour le V de Cramér, le calcul exige les conditions de Cochran (aucun effectif attendu sous 1, et au moins 80 % des effectifs attendus à 5 ou plus). Sinon, le repère est « à confirmer ».

R10 et R11 testent de nombreuses paires : les tests sont corrigés par la méthode de Holm (1979), qui tient le risque de signaler à tort au moins une paire sous 5 % en tout. Concrètement, chaque paire est jugée sur sa valeur p contre le seuil (test unilatéral « l'indicateur dépasse le seuil »), et les valeurs p sont ajustées par Holm.

Une variable constante (note identique pour tous, question à laquelle tout le monde a répondu pareil) n'a pas de corrélation ni de V de Cramér : la paire n'est pas jugée, et le repère de la variable constante (R8, R12) le dit.

## Conséquences

- Les repères restent prudents sur un petit jeu : beaucoup seront « à confirmer » au début des inscriptions, ce qui est juste.
- Les seuils sont dans une seule table de `utils/questionnaireQuality.ts` : en changer un est un changement de comportement qui passe par la spec.
- La note des repères suit celle de l'assistant : si R27 change, les repères suivent.
- Le calcul relit toutes les réponses du jeu à chaque ouverture de l'encadré. Pour quelques centaines d'inscriptions, c'est négligeable ; sinon, il faudra le garder en cache.

## Options écartées

- **Pourcentages fixés à la main, avec un nombre minimal de réponses** : aucune base statistique, et un nombre minimal ne tient pas compte de l'écart observé. Écarté par l'utilisatrice.
- **Alpha de Cronbach, analyse factorielle, VIF** : ils mesurent la cohérence d'une échelle qui vise un seul trait. Un questionnaire de casting pose des questions indépendantes, et ces méthodes demandent bien plus de réponses qu'un GN n'en reçoit.
- **Intervalle de Wald** : couverture mauvaise sur les petits effectifs (Brown, Cai et DasGupta, 2001).
- **Indice de variation qualitative seul** : il surestime la dispersion de distributions déséquilibrées. L'entropie normalisée reste en détail, et la part de la réponse la plus choisie donne la phrase.
- **Similarité de Jaccard pour les personnages** : elle ignore le poids des liens (1 ou ½, échelle). La similarité cosinus des profils de points suit la note de l'assistant.
