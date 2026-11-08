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

- [x] Étant donné une fiche avec une adresse dans les jeux de la propriétaire, quand je crée une fiche avec la même adresse (sans tenir compte des majuscules), alors aucune fiche n'est créée : mes jeux et mes notes s'ajoutent à la fiche existante, dont le nom et le téléphone ne changent pas, et un message me le dit.
- [x] Étant donné une co-organisatrice qui ne voit pas le jeu de la fiche existante, alors la fiche reçoit son jeu de la même façon, et elle n'en voit que son jeu.
- [x] Étant donné une fiche que je modifie, quand je lui donne l'adresse d'une autre fiche, alors l'enregistrement est refusé ; le refus nomme l'autre fiche, avec un lien, seulement si je vois l'un de ses jeux. Modifier autre chose qu'une adresse reste possible, même pour un doublon plus ancien.
- [x] Une fiche d'une autre propriétaire ne compte pas.
- [x] Étant donné les jeux de test, alors une personne présente dans plusieurs jeux (Camille, Lucie, Inès) n'a qu'une fiche, liée à chacun.

## Notes techniques

`ficheForAddress` et `duplicateAddressError` dans `server/utils/participantWrites.ts`, avec la portée des inscriptions (`participantEmailMatchWhere`), commun à l'interface et aux assistants d'IA ; `components/ParticipantForm.vue`, `pages/participants/index.vue` ; `prisma/seed.ts`. [SPEC-007](../../specs/SPEC-007-participants-et-rgpd.md), R5. Choix de l'utilisatrice le 2026-11-08 : la création rejoint la fiche existante, pour tout le monde, et chacune en voit ses jeux ; pas d'outil de fusion, d'où le refus d'un changement d'email.

## Tests

`tests/integration/participants.test.ts`, `tests/integration/seed.test.ts`, `tests/e2e/participants.spec.ts`.
