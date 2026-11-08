---
id: US-190
titre: Faire tenir par la base les règles des liens du questionnaire et des relations
statut: à faire
epic: EPIC-049
regles: []
adr: [ADR-0073]
---

# US-190 : Faire tenir par la base les règles des liens du questionnaire et des relations

En tant que mainteneuse de Limbus, je veux que la base refuse un lien du questionnaire sans cible, à plusieurs cibles ou en double, et une relation d'un personnage avec lui-même, afin que ces règles ne dépendent plus du seul code.

## Critères d'acceptation

- [ ] Un `RegistrationQuestionLink` vise exactement un personnage, un groupe ou une intrigue (contrainte `CHECK`).
- [ ] Deux liens identiques (même question, même option, même cible) sont refusés.
- [ ] Une `CharacterRelation` d'un personnage avec lui-même est refusée (contrainte `CHECK`) ; deux personnages peuvent garder plusieurs relations, dans un sens ou dans l'autre.
- [ ] Avant la migration, aucune ligne de production n'enfreint ces règles.

## Notes techniques

Contraintes écrites à la main et nommées (ADR-0073). L'unicité des liens porte sur des colonnes facultatives : `NULLS NOT DISTINCT` (PostgreSQL 15) ou un index par sorte de cible, à choisir selon ce que Prisma décrit.

ADR :
- [ADR-0073](../../adr/ADR-0073-enumerations-du-schema.md)

## Tests

Intégration : chaque règle refusée par la base ; les routes du questionnaire et des relations rendent un message clair avant d'y arriver.
