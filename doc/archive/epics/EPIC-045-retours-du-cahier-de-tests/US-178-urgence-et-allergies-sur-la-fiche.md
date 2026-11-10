---
id: US-178
titre: Voir le contact d'urgence et les allergies sur la fiche participante
statut: terminée
epic: EPIC-045
regles: [R1b]
adr: []
---

# US-178 : Voir le contact d'urgence et les allergies sur la fiche participante

En tant qu'organisatrice, je veux lire le contact d'urgence et les allergies d'une personne sur sa fiche, afin de ne pas avoir à chercher son inscription (test A5 du cahier, retours A5-1 et A5-2).

## Critères d'acceptation

- [x] Étant donné une personne inscrite au vivier d'un de mes jeux, alors sa fiche montre le contact d'urgence (nom et téléphone) et les allergies de son inscription la plus récente dans mes jeux, avec le jeu d'où ils viennent.
- [x] Étant donné une personne sans inscription dans mes jeux mais avec un compte, alors la fiche montre le contact d'urgence de son compte, et ses allergies seulement si elle a donné son accord santé.
- [x] Étant donné une personne sans inscription ni coordonnées dans son compte, alors la fiche indique « Non renseigné ».
- [x] Étant donné une inscription chez une autre équipe, alors ses données n'apparaissent pas sur ma fiche.
- [x] Ni la liste des participants, ni les assistants d'IA, ni le cache hors ligne ne reçoivent ces données : seule la fiche les demande.

## Notes techniques

`server/utils/participantEmergency.ts`, `server/api/participants/[id]/emergency.get.ts`, `pages/participants/[slug].vue`. [SPEC-007](../../../specs/SPEC-007-participants-et-rgpd.md), R1b. Choix de l'utilisatrice le 2026-11-08 : l'inscription, sinon le compte.

## Tests

`tests/integration/participantEmergency.test.ts`, `tests/integration/isolation.test.ts`, `tests/e2e/participants.spec.ts`.
