---
id: US-164
titre: Inviter une personne à rejoindre le vivier, ou pour une session
statut: terminée
epic: EPIC-046
regles: [R4]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-164 : Inviter une personne à rejoindre le vivier

En tant que organisatrice, je veux inviter une personne par email à rejoindre le vivier, afin de la caster comme les autres.

## Critères d'acceptation

- [x] Étant donné un nom et un email, quand j'invite, alors la personne reçoit un lien vers le questionnaire.
- [x] Étant donné qu'elle a répondu, alors elle est dans le vivier, avec le même parcours que les autres.
- [x] Étant donné une personne invitée sans réponse, alors elle n'est ni proposée ni castable, et je peux relancer ou renvoyer un lien.
- [x] Étant donné une invitation pour une session, quand la personne répond en se disant disponible, alors elle y est inscrite.
- [x] Étant donné cette session complète à sa réponse, alors elle reste pré-inscrite, et l'équipe reçoit un email.
- [x] Étant donné cette session passée ou annulée à sa réponse, alors elle entre simplement dans le vivier.

## Notes techniques

Remplace le mode invitation : `server/utils/registrations.ts`, statut `invited`, session facultative, écrans d'invitation de `RegistrationPeriodCard`.

## Tests

Intégration : `registrations.test.ts`, `registrationTracking.test.ts`, `publicRegistrations.test.ts`. Playwright : `registration.spec.ts`, `registrationActions.spec.ts`. Inviter depuis l'onglet Cast vient avec US-176.
