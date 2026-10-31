---
id: US-081
titre: Poser des questions propres au jeu
statut: terminée
epic: EPIC-019
regles: [R8, R9, R24]
adr: [ADR-0045]
---

# US-081 : Poser des questions propres au jeu

En tant qu'organisatrice, je veux ajouter au formulaire de mon jeu mes propres questions, afin de mieux connaître les personnes qui s'inscrivent.

## Critères d'acceptation

- [x] L'éditeur du formulaire ajoute, modifie, réordonne et retire des questions : libellé, sorte (texte libre, choix unique, choix multiple, échelle de 1 à 5), options pour un choix, obligatoire ou non.
- [x] L'aperçu montre les questions telles que la personne les verra.
- [x] Par le lien personnel et depuis « Je participe », la personne y répond ; une question obligatoire sans réponse est refusée, comme une option inconnue.
- [x] Une inscription garde la version du formulaire qu'elle a remplie : modifier une question ne change pas les réponses déjà données (R9).
- [x] Le détail d'une inscription montre ses réponses aux organisatrices ; l'export d'une personne les contient ; rien dans les documents envoyés ni dans l'export CSV (R24).

## Notes techniques

- Définition : `questions` ; réponses : `Registration.questionAnswers`.

## Tests

- Unitaires : schéma de la définition (ids attribués, options), schéma des réponses selon la version.
- Intégration : réponse enregistrée, refus d'une option inconnue, version gardée après modification, export.
