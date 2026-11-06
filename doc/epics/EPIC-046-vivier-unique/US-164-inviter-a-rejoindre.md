---
id: US-164
titre: Inviter une personne à rejoindre le vivier
statut: à faire
epic: EPIC-046
regles: [R4]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-164 : Inviter une personne à rejoindre le vivier

En tant que organisatrice, je veux inviter une personne par email à rejoindre le vivier, afin de la caster comme les autres.

## Critères d'acceptation

- [ ] Étant donné un nom et un email, quand j'invite, alors la personne reçoit un lien vers le questionnaire.
- [ ] Étant donné qu'elle a répondu, alors elle est dans le vivier, avec le même parcours que les autres.
- [ ] Étant donné une personne invitée sans réponse, alors elle n'est ni proposée ni castable, et je peux relancer ou renvoyer un lien.
- [ ] Étant donné l'invitation, alors aucune session n'y est liée.

## Notes techniques

Remplace le mode invitation : `server/utils/registrations.ts`, statut `invited` sans session, écrans d'invitation de `RegistrationPeriodCard`.

## Tests

Intégration : invitation, réponse, relance. Playwright : `registration.spec.ts`.
