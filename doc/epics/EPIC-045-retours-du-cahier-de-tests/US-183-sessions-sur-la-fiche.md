---
id: US-183
titre: Ouvrir les sessions d'une personne depuis sa fiche
statut: terminée
epic: EPIC-045
regles: [R1c]
adr: []
---

# US-183 : Ouvrir les sessions d'une personne depuis sa fiche

En tant qu'organisatrice, je veux voir sous chaque jeu de la fiche les sessions de la personne, avec un lien vers chacune, afin d'y aller sans la chercher (retour A5-4 du cahier).

## Critères d'acceptation

- [x] Étant donné une personne qui a un rôle dans une session (joueuse, PNJ, organisation, cuisine) ou y tient un personnage, alors la session figure sous son jeu, avec sa date, son statut si elle est annulée, reportée ou terminée, ses personnages et ses rôles, et un lien vers sa page.
- [x] Les sessions passées y figurent aussi, dans l'ordre des dates.
- [x] Étant donné un jeu sans session pour elle, alors il indique « Aucune session » ; si la lecture échoue, la fiche le dit au lieu de l'indiquer.
- [x] Une session d'un jeu d'une autre équipe n'apparaît pas.

## Notes techniques

`server/utils/participantSessions.ts`, `server/api/participants/[id]/sessions.get.ts`, `pages/participants/[slug].vue`. [SPEC-007](../../specs/SPEC-007-participants-et-rgpd.md), R1c. Choix de l'utilisatrice le 2026-11-08 : toutes ses sessions, pas seulement celles où elle joue.

## Tests

`tests/integration/participantSessions.test.ts`, `tests/integration/isolation.test.ts`, `tests/e2e/participants.spec.ts`.
