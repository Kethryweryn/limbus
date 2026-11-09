---
id: US-195
titre: Faire refuser par la base un lien entre deux jeux dans les sessions et le vivier
statut: à faire
epic: EPIC-049
regles: []
adr: [ADR-0074]
---

# US-195 : Faire refuser par la base un lien entre deux jeux dans les sessions et le vivier

En tant que mainteneuse de Limbus, je veux que la base refuse qu'une session, une inscription, un paiement ou un fichier soit relié à un élément d'un autre jeu, afin que l'isolation des jeux ne dépende plus du seul code.

Suite de l'[US-191](US-191-meme-jeu-impose-par-la-base.md), qui a traité le contenu d'écriture.

## Critères d'acceptation

- [ ] `Location` et `Session` ont une unicité `(id, gameId)`.
- [ ] Reçoivent le jeu et référencent `(id, gameId)` de chaque côté : `SessionAssignment` (session, personnage, place réservée), `TimelineEventResponsible`, `SessionDocumentDelivery`, `SessionTrombinoscope`, `RegistrationPeriodSession`, `RegistrationDraw`, `Registration` (jeu de son vivier : session d'invitation, version du formulaire), `RegistrationSession`.
- [ ] Référencent `(id, gameId)` : `Session.locationId`, `Session.postponedToSessionId`, `SessionPayment.carriedOverToSessionId`, `UploadedFile.sessionId`.
- [ ] Les deux garde-fous de `tests/integration/sameGame.test.ts` n'ont plus d'exception.
- [ ] Avant la migration, aucune ligne de production n'enfreint ces règles.

## Notes techniques

Références facultatives qui s'effaçaient (`Session.locationId`, `Session.postponedToSessionId`, `RegistrationDraw.sessionId`, `Registration.invitedSessionId`, `SessionPayment.carriedOverToSessionId`…) : `onDelete: NoAction`, la suppression vide la référence d'abord (ADR-0074). Une ligne qui reçoit le jeu le reçoit de sa session ou de son vivier ; la version du formulaire le reçoit de son formulaire. Migrations marquées incompatibles.

ADR :
- [ADR-0074](../../adr/ADR-0074-meme-jeu-impose-par-la-base.md)

## Tests

Intégration : chaque sorte de lien refusée entre deux jeux dans `tests/integration/sameGame.test.ts` ; `tests/integration/isolation.test.ts` ; suite complète. Bout en bout : sessions, inscriptions, paiements, envois, trombinoscopes.
