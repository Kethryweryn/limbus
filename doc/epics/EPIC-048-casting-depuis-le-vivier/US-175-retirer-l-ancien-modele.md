---
id: US-175
titre: Retirer l'ancien modèle des inscriptions
statut: terminée
epic: EPIC-048
regles: [R3]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md, ../../adr/ADR-0070-liens-personnels-durables.md]
---

# US-175 : Retirer l'ancien modèle des inscriptions

En tant que développeuse, je veux retirer les anciennes tables et colonnes, afin qu'une seule source dise le statut d'une personne.

## Critères d'acceptation

- [x] Étant donné tout le code passé au nouveau modèle, quand la seconde migration passe, alors les anciennes tables et colonnes ont disparu, et la migration porte son commentaire `-- deploiement-incompatible`.
- [x] Étant donné les documents, alors SPEC-001, SPEC-009, SPEC-014, ADR-0046 à ADR-0048 et ADR-0018 renvoient vers ce qui les remplace ou sont à jour, SPEC-015 et SPEC-016 sont relues, et ADR-0069 et ADR-0070 sont acceptés.
- [x] Étant donné les outils d'IA, alors leur description ne parle plus de périodes par session.

## Notes techniques

Sans changement visible : pas de note de nouveautés. La seconde migration est partie plus tôt que prévu, dans la PR #160, dès que plus rien ne lisait l'ancien modèle. Les outils d'IA gardent leur nom pour ne pas casser les assistants branchés : seules leurs descriptions comptent ici, et elles parlent déjà du vivier.

## Tests

Suite complète en CI ; `tests/integration/seed.test.ts`.
