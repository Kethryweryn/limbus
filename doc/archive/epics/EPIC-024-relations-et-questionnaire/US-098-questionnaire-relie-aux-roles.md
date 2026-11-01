---
id: US-098
titre: Relier les réponses du questionnaire aux personnages, factions et intrigues
statut: terminée
epic: EPIC-024
regles: [R8]
adr: [ADR-0050]
---

# US-098 : Relier les réponses du questionnaire aux personnages, factions et intrigues

En tant qu'organisatrice, je veux relier les réponses possibles de mon questionnaire aux rôles qu'elles désignent, pour voir quels rôles conviennent à chaque inscrit.

## Critères d'acceptation

- [x] Dans l'éditeur du formulaire, chaque option d'une question à choix, et chaque question sur une échelle, se relie à des personnages, factions et intrigues du jeu.
- [x] Les liens s'enregistrent avec le formulaire, sans créer de nouvelle version tant que les questions ne changent pas ; renommer une option garde ses liens.
- [x] Dans le détail d'une inscription, chaque réponse montre les personnages, factions et intrigues qu'elle désigne.
- [x] Les liens ne se voient jamais côté inscrit (R24) ; la copie d'un jeu les copie.

## Notes techniques

- `RegistrationQuestionLink` ; `GET` et `PUT /api/games/:id/registration-question-links`.

## Tests

- Intégration : enregistrement, refus d'un élément d'un autre jeu, affichage dans le détail, copie, isolation.
