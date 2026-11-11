---
id: US-239
titre: Une fiche par adresse dans tout Limbus
statut: terminée
epic: EPIC-056
regles: [R4, R5, R7]
adr: [ADR-0086]
---

# US-239 : Une fiche par adresse dans tout Limbus

En tant qu'organisatrice, je veux qu'une personne n'ait qu'une fiche, même suivie par d'autres équipes, sans rien voir de ces équipes, afin qu'elle soit la même personne partout.

## Critères d'acceptation

- [x] Étant donné une fiche de Paul dans les jeux de Bob, quand Alice crée une fiche avec l'adresse de Paul (sans tenir compte des majuscules), alors aucune fiche n'est créée : les jeux et notes d'Alice s'ajoutent à la fiche, avec le nom et le téléphone saisis par Alice pour ses jeux ; le message est celui d'une création.
- [x] Étant donné la fiche de Paul déjà dans les jeux d'Alice, alors le message dit que ses jeux ont été ajoutés à la fiche existante, comme aujourd'hui.
- [x] Étant donné la fiche commune, alors Alice ne voit que ses jeux, notes, casts, inscriptions, envois et paiements, et ses valeurs de nom et de téléphone ; Bob de même.
- [x] Étant donné une fiche dont je corrige l'adresse, alors seuls les jeux que je vois, avec leurs notes, valeurs, inscriptions, casts et envois, passent à la fiche de la nouvelle adresse (créée si besoin) ; les autres jeux gardent l'ancienne ; aucun compte ne change d'adresse.
- [x] Une inscription (lien personnel, formulaire public, vivier) rejoint la fiche de son adresse dans tout Limbus.
- [x] L'adresse de page d'une fiche (slug) ne suit plus son nom : un nom donné par une équipe ne doit pas apparaître dans l'adresse que voit une autre (constat d'US-237).
- [x] Tant que des doublons existent (avant [US-240](US-240-fusion-des-fiches.md)), la fiche rejointe est la plus ancienne de l'adresse.
- [x] Étant donné les jeux de test, alors une personne est suivie par deux propriétaires, chacune avec son nom ; `doc/jeux-de-test.md` le dit.

## Notes techniques

Remplace `ficheForAddress`, limitée à la propriétaire, et `duplicateAddressError` (US-185) ([ADR-0086](../../adr/ADR-0086-fiche-unique-et-valeurs-par-jeu.md)). Rapprochement des inscriptions (`participantEmailMatchWhere`, `formRegistrations`, `publicRegistrations`). L'index unique sur l'adresse arrive avec la fusion ([US-240](US-240-fusion-des-fiches.md)). Jeux de test : `prisma/seed/` et `doc/jeux-de-test.md` (CLAUDE.md, ADR-0066).

## Tests

- Actions : création rejointe (deux équipes), correction d'adresse qui ne déplace que les jeux visibles.
- Erreurs de saisie : adresse invalide refusée, rien d'enregistré.
- Droits : Alice ne voit rien de Bob sur la fiche commune (liste, fiche, export, assistants) ; co-organisatrice d'un seul jeu ; `isolation.test.ts`.
- Hors ligne : création mise en file qui rejoint la fiche au retour du réseau.

## Avancement

- Étape 1 : la fiche d'une adresse est cherchée dans tout Limbus (`ficheForAddress`, `findParticipantByEmail`, la plus ancienne tant que des doublons existent) à la création, à l'invitation et à la réponse au formulaire ; une équipe qui la rejoint garde ses propres nom et téléphone, et la réponse est celle d'une création si la fiche n'était pas dans ses jeux ; l'adresse de page est neutre (`p-` et dix caractères, `utils/participantSlug.ts`), fixée à la création, et la migration `20261201090000_adresse_neutre_des_fiches` remplace les existantes (choix de l'utilisatrice, revue de la PR #232) ; la fiche et l'export d'une équipe donnent ses propres nom, téléphone et dates ; jeux de test : le Carnet d'Inès, où Sarah Petit s'appelle « Sarah P. ». Tests : `participants.test.ts`, `registrations.test.ts`, `formRegistrations.test.ts`, `seed.test.ts`, `tests/server/registrations.test.ts`, `participants.spec.ts`. La correction d'adresse par équipe (R7) vient à l'étape 2 : d'ici là, changer l'adresse vers celle d'une autre fiche reste refusé, sans nommer une fiche hors de vue.
- Étape 2 : correction d'adresse par équipe (R7) : changée sur place si l'équipe voit tous les jeux de la fiche et qu'aucune autre fiche ne porte l'adresse ; sinon, ses jeux passent à la fiche de cette adresse, créée au besoin, par la fonction SQL `limbus_move_participant` (migration `20261202090000_deplacer_une_fiche`, commune à la fusion d'US-240) ; la fiche d'origine, vide, disparaît. Le refus « adresse déjà prise » et le lien vers l'autre fiche disparaissent. Tests : `tests/integration/participantMove.test.ts` (déplacement, rejointe, sur place, réunion de deux fiches, toutes les tables couvertes), `participantScreens.spec.ts` (« corriger l’adresse »).
