---
id: US-191
titre: Faire refuser par la base un lien entre deux jeux
statut: à faire
epic: EPIC-049
regles: []
adr: [ADR-0074]
---

# US-191 : Faire refuser par la base un lien entre deux jeux

En tant que mainteneuse de Limbus, je veux que la base refuse un lien entre éléments de deux jeux différents, afin que l'isolation des jeux ne dépende plus du seul code.

## Critères d'acceptation

- [ ] Chaque élément d'un jeu a une unicité `(id, gameId)`.
- [ ] Chaque lien entre deux éléments référence `(id, gameId)` de chaque côté ; les tables de liaison implicites deviennent des modèles explicites, leurs lignes recopiées.
- [ ] Un lien entre deux jeux, écrit directement en base, est refusé.
- [ ] Les routes et les outils des assistants gardent leurs vérifications et leurs messages.

## Notes techniques

Lot le plus lourd ; à découper à l'implémentation si besoin (contenu de l'écriture, puis sessions). Les liens d'une session au vivier, aux envois et aux trombinoscopes sont compris. Références facultatives à effacement (`Item.locationCharacterId`, `Session.locationId`, `RegistrationDraw.sessionId`, `Registration.invitedSessionId`) : `onDelete: NoAction`, la suppression vide la référence d'abord (ADR-0074). Migrations marquées incompatibles ; anciennes tables de liaison retirées au déploiement suivant.

ADR :
- [ADR-0074](../../adr/ADR-0074-meme-jeu-impose-par-la-base.md)

## Tests

Intégration : un lien entre deux jeux refusé par la base pour chaque sorte de lien ; `tests/integration/isolation.test.ts` ; Playwright des fiches d'écriture et des sessions touchées.
