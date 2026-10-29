---
id: US-038
titre: Retirer `Participant.published`
statut: à faire
epic: EPIC-007
regles: []
adr: []
---

# US-038 : Retirer `Participant.published`

En tant que développeuse, je veux retirer un champ qui n'a aucun effet, afin qu'il ne laisse pas croire qu'une fiche peut être masquée.

## Critères d'acceptation

- [ ] L'API n'accepte ni ne renvoie plus `published` pour une fiche ; l'interface ne l'envoie plus.
- [ ] La colonne reste en base, sans usage ([ADR-0024](../../adr/ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).

## Notes techniques

- Schémas de `server/utils/schemas.ts`, routes `participants`, `pages/participants/index.vue`.

## Tests

- Intégration : une fiche créée sans `published` est lue sans ce champ.
