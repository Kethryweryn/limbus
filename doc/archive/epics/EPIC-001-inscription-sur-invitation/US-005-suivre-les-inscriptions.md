---
id: US-005
titre: Suivre et gérer les inscriptions
statut: terminée
epic: EPIC-001
regles: [R16, R20, R21, R24]
adr: [ADR-0020, ADR-0021]
---

# US-005 : Suivre et gérer les inscriptions

En tant qu'organisatrice, je veux voir où en est chaque inscription de ma période d'inscription, afin de relancer, prolonger ou libérer des places.

## Critères d'acceptation

- [x] La page d'une période d'inscription liste les inscriptions par session, avec :
  - nom, statut, date d'invitation, échéance, date de réponse ;
  - un compteur par statut face aux places.
- [x] Les inscriptions dont l'échéance est passée sans réponse sont signalées « délai dépassé » (R20).
- [x] Sur une inscription sans réponse, je peux :
  - relancer, avec un email de rappel au même lien ;
  - prolonger l'échéance d'un nombre de jours ;
  - libérer la place, ce qui la fait passer à `désistée` et invalide le lien.
- [x] Le détail d'une inscription montre les réponses au formulaire : contact, contact d'urgence, allergies avec la date du consentement.
- [x] Je peux retirer une personne confirmée, avec les mêmes effets qu'un désistement (US-006 : `withdrawRegistration` avec l'organisatrice comme auteur).
- [x] Si une personne confirmée n'est plus participante de la session, parce qu'elle a été retirée à la main de l'écran de session, la liste le signale (ADR-0021).
- [x] Export CSV des inscriptions d'une session : nom, email, téléphone, statut. Les données de santé n'y figurent pas ; elles passent par la fiche allergies (US-008).

## Réalisation

- **Relance** : seul le hash du jeton est stocké (ADR-0018), on ne peut donc pas renvoyer le même lien. Choix du 2026-10-28 : la relance est un rappel **sans lien**, qui invite à reprendre l'email d'invitation (date d'envoi rappelée) ; l'ancien lien reste valable. Si la personne a perdu l'email, elle prévient l'équipe, et « Nouveau lien » renvoie l'invitation avec un nouveau lien et invalide l'ancien. La date de la dernière relance est notée (`Registration.lastRemindedAt`). Une invitation dont l'email n'est jamais parti garde le bouton « Envoyer ».
- **Prolongation** : l'organisatrice choisit la nouvelle date d'échéance (dans le futur, au plus un an après aujourd'hui).
- **Délai dépassé** : simple signalement ; la personne peut encore répondre tant que sa place n'est pas libérée (ADR-0020).
- **Libération** : l'inscription passe à `désistée`, avec l'organisatrice comme autrice. Le lien ne permet plus de répondre et affiche « Sans réponse de votre part dans le délai, votre place a été réattribuée. » La personne peut être réinvitée (R16). « Annuler » reste possible pour effacer une invitation faite par erreur.
- **Retrait** d'une personne confirmée : `POST /api/registrations/:id/withdraw`, qui appelle `withdrawRegistration` avec l'organisatrice comme autrice.
- **Détail** : `GET /api/registrations/:id`, ouvert depuis le bouton « Détail » de la liste.
- **Compteur** : un badge par statut présent (invitée, délai dépassé, confirmée, désistée), sous le titre de la session.
- **Export CSV** : `GET /api/sessions/:id/registrations/export`, séparateur point-virgule et BOM pour Excel ; une cellule qui commencerait par `=`, `+`, `-` ou `@` est neutralisée.

## Notes techniques

- Routes : `GET /api/registration-periods/:id/registrations` (créée par US-003, à enrichir des réponses et du statut effectif), `POST /api/registrations/:id/remind`, `POST /api/registrations/:id/extend`, `POST /api/registrations/:id/release`.
- Statut « délai dépassé » calculé à la lecture ([ADR-0020](../../../adr/ADR-0020-echeances-evaluees-a-la-lecture.md)).

## Tests

- Unitaires : calcul du statut effectif (échéance, clôture).
- Intégration : relance, prolongation, libération qui invalide le lien ; signalement d'une personne retirée de la session ; ajout de chaque route à `isolation.test.ts`.
