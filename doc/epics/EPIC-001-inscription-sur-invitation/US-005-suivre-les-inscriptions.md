---
id: US-005
titre: Suivre et gérer les inscriptions
statut: à faire
epic: EPIC-001
regles: [R16, R20, R21, R24]
adr: [ADR-0020, ADR-0021]
---

# US-005 : Suivre et gérer les inscriptions

En tant qu'organisatrice, je veux voir où en est chaque inscription de ma période d'inscription, afin de relancer, prolonger ou libérer des places.

## Critères d'acceptation

- [ ] La page d'une période d'inscription liste les inscriptions par session, avec :
  - nom, statut, date d'invitation, échéance, date de réponse ;
  - un compteur par statut face aux places.
- [ ] Les inscriptions dont l'échéance est passée sans réponse sont signalées « délai dépassé » (R20).
- [ ] Sur une inscription sans réponse, je peux :
  - relancer, avec un email de rappel au même lien ;
  - prolonger l'échéance d'un nombre de jours ;
  - libérer la place, ce qui la fait passer à `désistée` et invalide le lien.
- [ ] Le détail d'une inscription montre les réponses au formulaire : contact, contact d'urgence, allergies avec la date du consentement.
- [ ] Je peux retirer une personne confirmée, avec les mêmes effets qu'un désistement (US-006).
- [ ] Si une personne confirmée n'est plus participante de la session, parce qu'elle a été retirée à la main de l'écran de session, la liste le signale (ADR-0021).
- [ ] Export CSV des inscriptions d'une session : nom, email, téléphone, statut. Les données de santé n'y figurent pas ; elles passent par la fiche allergies (US-008).

## Notes techniques

- Routes : `GET /api/registration-periods/:id/registrations`, `POST /api/registrations/:id/remind`, `POST /api/registrations/:id/extend`, `POST /api/registrations/:id/release`.
- Statut « délai dépassé » calculé à la lecture ([ADR-0020](../../adr/ADR-0020-echeances-evaluees-a-la-lecture.md)).

## Tests

- Unitaires : calcul du statut effectif (échéance, clôture).
- Intégration : relance, prolongation, libération qui invalide le lien ; signalement d'une personne retirée de la session ; ajout de chaque route à `isolation.test.ts`.
