---
id: US-144
titre: Voir les questions à relire
statut: terminée
epic: EPIC-042
regles: [R11]
adr: [ADR-0062]
---

# US-144 : Voir les questions à relire

En tant qu'organisatrice, je veux voir les défauts de rédaction que des règles repèrent dans mes questions, afin de les corriger avant d'ouvrir les inscriptions.

## Critères d'acceptation

- [x] L'encadré « Qualité du questionnaire » a une partie « Rédaction », avec son niveau et le nombre de signalements dans le titre. Elle est dépliée tant qu'aucune réponse n'est reçue, repliée ensuite, et porte sur le formulaire enregistré, ce qu'elle dit.
- [x] Les signalements sont groupés par question : le libellé sert de titre, chaque défaut est « à surveiller », avec sa règle, ce qu'il faut vérifier et, en détail, sa référence.
- [x] Double sens : un « et » ou un « ou » dans le libellé d'une question à choix ou d'une échelle, ou dans une option. « où » ne compte pas.
- [x] Double négation : au moins deux négations dans le libellé, selon la définition d'ADR-0062.
- [x] Format « d'accord » : « d'accord » dans le libellé ou une option.
- [x] Quantifieur vague : un mot de la liste dans le libellé ou une option. « Peu importe » ne compte pas.
- [x] Longueur : une question au-delà de Q3 + 1,5 × (Q3 − Q1) mots, sans signalement si l'écart interquartile est nul. Le détail donne le nombre de mots de chaque question.
- [x] Une question à texte libre n'a que le repère de longueur.
- [x] Sans signalement, la partie dit qu'il n'y a rien à relire.

## Notes techniques

- `utils/questionnaireDrafting.ts` : fonctions pures ; `quantile` (`utils/statistics.ts`) pour les quartiles.
- La route de l'encadré rend `drafting`. Phrases : `utils/questionnaireDraftingText.ts`. Affichage : `components/RegistrationFormDrafting.vue`.

## Tests

- Unitaires : chaque règle, avec ses faux positifs écartés (« où », « Peu importe », « n'... pas » compté une fois, « n° », « pas à pas »), phrases coupées à « … », apostrophes droite et typographique, seuil de Tukey, écart interquartile nul.
- Intégration : la route rend les signalements.
- Bout en bout : la partie affiche un signalement groupé sous sa question, puis se replie une fois des réponses reçues.
