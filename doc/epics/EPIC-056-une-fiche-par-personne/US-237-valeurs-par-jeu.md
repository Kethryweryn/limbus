---
id: US-237
titre: Le nom et le téléphone saisis par jeu
statut: terminée
epic: EPIC-056
regles: [R6]
adr: [ADR-0086]
---

# US-237 : Le nom et le téléphone saisis par jeu

En tant qu'organisatrice, je veux que le nom et le téléphone que je saisis sur une fiche soient ceux de mes jeux, afin qu'une autre équipe qui suit la même personne ne les voie ni ne les change.

## Critères d'acceptation

- [x] Étant donné une fiche existante, quand la migration passe, alors chacun de ses jeux porte le nom et le téléphone de la fiche ; rien ne change à l'écran.
- [x] Étant donné une fiche que je modifie, quand j'enregistre un nom ou un téléphone, alors il s'applique à tous les jeux de la fiche que je vois, et à eux seuls.
- [x] Étant donné une co-organisatrice qui ne voit qu'un des jeux de la fiche, quand elle modifie le nom, alors seul ce jeu change ; la propriétaire voit le nom de son jeu le plus récemment modifié.
- [x] Étant donné une fiche rattachée à un compte dont la personne a enregistré ses coordonnées, alors le nom et le téléphone du compte restent recopiés sur chaque jeu, comme aujourd'hui (ADR-0042).
- [x] Étant donné deux co-organisatrices qui modifient le nom en même temps, alors la seconde est refusée (« modifiée entre-temps »), en ligne comme au retour du réseau.
- [x] Les listes, cast, trombinoscopes, fiche allergies, exports, emails et outils des assistants d'IA lisent le nom et le téléphone du jeu concerné.

## Notes techniques

Colonnes `name`, `phone` et `updatedAt` sur `ParticipantGame` ([ADR-0086](../../adr/ADR-0086-fiche-unique-et-valeurs-par-jeu.md)), remplies par la migration ; les colonnes de `Participant` restent écrites et lues par le build en service jusqu'à [US-242](US-242-retirer-nom-et-telephone-de-la-fiche.md) (ADR-0024). Écriture commune par `server/utils/participantWrites.ts` (interface et assistants), recopie du compte (`syncProfileToParticipants`) sur les liens.

## Tests

- Actions et droits : `tests/e2e/participantScreens.spec.ts` (« nom par jeu ») : une co-organisatrice renomme la fiche, seul son jeu change ; l'organisatrice lit dans chaque session le nom du jeu de la session ; une modification d'une autre équipe ne refuse pas la sienne.
- Erreurs de saisie : inchangées (nom obligatoire), couvertes par les tests existants de la fiche.
- Hors ligne : la modification mise en file et le conflit entre deux onglets restent couverts par `participantScreens.spec.ts` ; la version lue est désormais celle des liens visibles.
- Intégration : `tests/integration/participants.test.ts` (écritures par jeu, lectures par équipe, version par équipe) ; unitaires : `tests/server/participantValues.test.ts`, `tests/utils/participantNames.test.ts`.

## Avancement

- Étape 1 : colonnes `name`, `phone` et `updatedAt` sur `ParticipantGame`, migration `20261128090000_nom_et_telephone_par_jeu`, écritures sur la fiche et sur chaque lien (création, modification des jeux visibles, recopie du compte, inscriptions, invitations, jeux de test) ; `tests/integration/participants.test.ts`. Les lectures passent aux liens à l'étape 2, dont la migration recopie de nouveau la fiche sur ses liens : une écriture de l'ancien build pendant le déploiement de l'étape 1 (revue de la PR #228) n'y laisse ni lien vide ni valeur en retard.
- Étape 2 : lectures par jeu (`server/utils/participantValues.ts` : `withGameValues`, `withGameValuesIn`, `namesIn`, `latestVisibleValues`) dans la liste et la fiche, les sessions, le cast et son assistant, le déroulé, les documents, la fiche allergies, les paiements, la présence, l'annulation, le vivier, la sélection, les affinités, l'export CSV, les emails et les outils des assistants ; tris faits à l'affichage ; migration `20261129090000_recopie_nom_par_jeu` ; `tests/server/participantValues.test.ts`, `tests/integration/participants.test.ts` (même fiche, deux noms, deux équipes).
- Étape 3 : version d'une fiche pour une équipe = plus récent `updatedAt` de ses liens visibles (`assertParticipantUnmodifiedSince`, lecture, modification, suppression, `lister_participants`) ; la liste donne le nom de chaque jeu visible (`gameNames`), que les listes d'une session affichent (`nameInGame`).
