---
id: US-195
titre: Faire refuser par la base un lien entre deux jeux dans les sessions et le vivier
statut: terminée
epic: EPIC-049
regles: []
adr: [ADR-0074, ADR-0077]
---

# US-195 : Faire refuser par la base un lien entre deux jeux dans les sessions et le vivier

En tant que mainteneuse de Limbus, je veux que la base refuse qu'une session, une inscription, un paiement ou un fichier soit relié à un élément d'un autre jeu, afin que l'isolation des jeux ne dépende plus du seul code.

Suite de l'[US-191](US-191-meme-jeu-impose-par-la-base.md), qui a traité le contenu d'écriture.

## Critères d'acceptation

- [x] `Location` et `Session` ont une unicité `(id, gameId)`.
- [x] Reçoivent le jeu et référencent `(id, gameId)` de chaque côté : `SessionAssignment` (session, personnage, place réservée), `TimelineEventResponsible`, `SessionDocumentDelivery`, `SessionTrombinoscope`, `RegistrationPeriodSession`, `RegistrationDraw`, `Registration` (jeu de son vivier : session d'invitation, version du formulaire), `RegistrationSession`.
- [x] Référencent `(id, gameId)` : `Session.locationId`, `Session.postponedToSessionId`, `SessionPayment.carriedOverToSessionId`, `UploadedFile.sessionId`.
- [x] Les deux garde-fous de `tests/integration/sameGame.test.ts` n'ont plus d'exception.
- [x] Avant la migration, aucune ligne de production n'enfreint ces règles.

## Notes techniques

- Reçoivent le jeu, rempli par la migration depuis leur session, leur vivier ou leur formulaire : `SessionAssignment`, `TimelineEventResponsible`, `SessionDocumentDelivery`, `SessionTrombinoscope`, `RegistrationPeriodSession`, `RegistrationSession`, `SessionPayment`, `RegistrationDraw`, `Registration`, `RegistrationRequest` et `RegistrationFormVersion`. `RegistrationRequest` et `RegistrationFormVersion` s'y ajoutent : la version du formulaire porte le jeu, et une demande la référence avec son vivier.
- Unicité `(id, gameId)` sur `Session`, `Location`, `RegistrationPeriod`, `RegistrationForm`, `RegistrationFormVersion` et `Registration` ; deux relations un-à-un reçoivent aussi une unicité composée, que Prisma exige (`Session.postponedToSessionId`, `RegistrationPeriodSession.sessionId`).
- Les dix références qui se vident à la suppression de leur cible sont en `ON DELETE SET NULL (colonne)`, écrites à la main dans la migration : la base n'efface que l'identifiant et garde le jeu ([ADR-0077](../../adr/ADR-0077-references-videes-par-la-base.md), choix de l'utilisatrice). Le code ne vide plus l'objet porté par un personnage ; il vide encore le lieu des sessions, pour faire avancer leur version (ADR-0036).
- Le code fournit le jeu à chaque écriture, depuis la session, le vivier ou l'inscription qu'il a déjà lus ; une écriture imbriquée le reçoit de sa ligne parente.
- Le RIB d'essai du jeu Valombre était créé sans jeu, donc hors du stockage compté : corrigé dans `prisma/seed/valombre.ts`. La migration donne à tout fichier de session le jeu de sa session, puis rend `UploadedFile.gameId` obligatoire : sans jeu, la clé de sa session ne serait pas contrôlée.
- Migration écrite à la main et marquée incompatible : pendant les secondes du déploiement, une écriture du build d'avant dans ces tables échoue, envoi du formulaire public compris (accepté par l'utilisatrice). Production relevée le 2026-11-09 : aucun lien ne relie deux jeux.

ADR :
- [ADR-0074](../../adr/ADR-0074-meme-jeu-impose-par-la-base.md)
- [ADR-0077](../../adr/ADR-0077-references-videes-par-la-base.md)

## Tests

- Intégration : `tests/integration/sameGame.test.ts` (chaque sorte de lien des sessions, du vivier, des paiements et des fichiers refusée entre deux jeux, avec un témoin ; suppressions qui vident les références en gardant le jeu, cascade de l'effacement d'une personne comprise ; les deux garde-fous sans exception ; chaque référence vidée n'efface que son identifiant). Suite complète.
- Bout en bout : suite complète.
- Migration jouée sur une base au schéma d'avant, une ligne par table : chaque ligne reçoit le jeu de sa session, de son vivier ou de son formulaire ; différence avec le schéma limitée aux anciennes tables de liaison.
