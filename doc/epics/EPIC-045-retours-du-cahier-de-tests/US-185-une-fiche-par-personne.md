---
id: US-185
titre: Une seule fiche par personne dans mes jeux
statut: terminée
epic: EPIC-045
regles: [R5]
adr: []
---

# US-185 : Une seule fiche par personne dans mes jeux

En tant qu'organisatrice, je veux qu'une personne n'ait qu'une fiche dans mes jeux, afin de ne voir qu'une carte par personne dans la page Participants (retour A5-5 du cahier).

## Critères d'acceptation

- [x] Étant donné une fiche de mes jeux avec une adresse, quand je crée une fiche avec la même adresse (sans tenir compte des majuscules), alors la création est refusée, avec le nom de la fiche existante et un bouton pour l'ouvrir et lui ajouter le jeu.
- [x] Étant donné une fiche que je modifie, quand je lui donne l'adresse d'une autre fiche de mes jeux, alors l'enregistrement est refusé de la même façon ; modifier autre chose qu'une adresse reste possible, même pour un doublon plus ancien.
- [x] Une fiche d'une autre équipe, hors de mes jeux, ne bloque rien.
- [x] Étant donné les jeux de test, alors une personne présente dans plusieurs jeux (Camille, Lucie, Inès) n'a qu'une fiche, liée à chacun.

## Notes techniques

`assertNoOtherFiche` dans `server/utils/participantWrites.ts`, commun à l'interface et aux assistants d'IA ; `components/ParticipantForm.vue` ; `prisma/seed.ts`. [SPEC-007](../../specs/SPEC-007-participants-et-rgpd.md), R5. Choix de l'utilisatrice le 2026-11-08 : jeux de test et refus des doublons, sans outil de fusion.

## Tests

`tests/integration/participants.test.ts`, `tests/integration/seed.test.ts`, `tests/e2e/participants.spec.ts`.
