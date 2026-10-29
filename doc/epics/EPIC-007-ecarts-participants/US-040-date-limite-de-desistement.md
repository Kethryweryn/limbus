---
id: US-040
titre: Date limite de désistement
statut: terminée
epic: EPIC-007
regles: [R16, R17]
adr: [ADR-0033]
---

# US-040 : Date limite de désistement

En tant qu'organisatrice, je veux fixer une date après laquelle une place n'est plus remboursée qu'à notre discrétion, et que les personnes la connaissent.

## Critères d'acceptation

- [x] L'onglet Paiements règle une date limite de désistement, facultative.
- [x] Pour le paiement d'une personne partie, sans décision, Limbus propose « à rembourser » avant la date et « gardé, non remboursé » après ; l'organisatrice décide.
- [x] L'email de paiement, et son aperçu, donnent la date et disent qu'après elle, le remboursement est laissé à l'appréciation de l'organisation.

## Notes techniques

- Colonne `Session.withdrawalDeadline DateTime?`, réglée avec le RIB et le lien ; elle ne change pas la version de la session ([ADR-0028](../../adr/ADR-0028-version-d-une-session.md)).

## Tests

- Unitaires : proposition avant et après la date.
- Intégration (`sessionTariffs.test.ts`) : date enregistrée, présente dans l'email.
