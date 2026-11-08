---
id: US-192
titre: Comparer les adresses email sans tenir compte de la casse dans la base
statut: à faire
epic: EPIC-049
regles: []
adr: [ADR-0075]
---

# US-192 : Comparer les adresses email sans tenir compte de la casse dans la base

En tant que mainteneuse de Limbus, je veux que la base compare les adresses sans tenir compte des majuscules, afin qu'une écriture qui oublierait la mise en minuscules ne crée pas de doublon.

## Critères d'acceptation

- [ ] L'extension `citext` est activée par migration.
- [ ] Les colonnes d'adresse listées dans ADR-0075 sont en `citext` ; « Lea@x.fr » et « lea@x.fr » sont la même adresse pour la base.
- [ ] Les `mode: 'insensitive'` sur ces colonnes sont retirés.
- [ ] Avant la migration, aucun doublon ne diffère que par la casse en production.

## Notes techniques

Vérifier que l'utilisatrice PostgreSQL du serveur peut créer l'extension, et sa déclaration dans le schéma Prisma 7. Changement de type : migration marquée incompatible. Coordonner avec la fiche [Un compte pour chaque participant](../../todo/compte-pour-chaque-participant.md), qui change `Participant`.

ADR :
- [ADR-0075](../../adr/ADR-0075-emails-en-citext.md)

## Tests

Intégration : un compte en double par la casse refusé ; suites des comptes, des participants et des inscriptions.
