---
id: US-194
titre: Stocker les dates avec leur fuseau horaire
statut: en cours
epic: EPIC-049
regles: []
adr: [ADR-0076]
---

# US-194 : Stocker les dates avec leur fuseau horaire

En tant que mainteneuse de Limbus, je veux que les dates soient stockées avec leur fuseau, afin qu'un instant garde son sens dans le SQL écrit à la main et quel que soit le fuseau du serveur.

## Critères d'acceptation

- [ ] Toutes les colonnes de date sont en `timestamptz(3)`, l'existant lu comme de l'UTC.
- [ ] Avant la migration, une base réglée sur Europe/Paris comme la production, avec des dates d'avant la conversion, est convertie ; le build en service et le nouveau y lisent et écrivent les mêmes instants (base locale plutôt qu'une copie de la production : choix de l'utilisatrice).
- [x] Les connexions de Prisma ouvrent leur session en UTC, quel que soit le fuseau de la base.
- [ ] Un test vérifie que toute colonne de date du schéma déclare `@db.Timestamptz(3)`.

## Notes techniques

Dernier lot de l'epic, en deux déploiements (ADR-0076) :

1. **Connexion en UTC** : la production est réglée sur Europe/Paris, et l'adaptateur pg de Prisma 7 décale les dates d'une colonne `timestamptz` quand la session n'est pas en UTC (prisma/orm#26786, #28629). Vérifié sur une base réglée comme la production : après conversion sans ce réglage, chaque date existante ressortait décalée d'une à deux heures. Le réglage seul ne change rien aux colonnes `timestamp` actuelles : Prisma y écrit et lit en UTC, et `createdAt` et `updatedAt` concordent en production.
2. **Conversion** : 115 colonnes en `timestamptz(3)`, l'existant lu comme de l'UTC (`USING … AT TIME ZONE 'UTC'`, sans quoi PostgreSQL le lirait comme de l'heure de Paris). Migration marquée incompatible.

Exception relevée à la revue : une date posée par la base pendant une migration (`DEFAULT CURRENT_TIMESTAMP` d'une colonne ajoutée) a été écrite dans le fuseau de la session de migration, Europe/Paris. En production, la migration de l'US-188 s'est terminée à 23:44:54 UTC, mais 66 fiches et 96 lignes de casting portent `createdAt = 00:44:52` : une heure d'avance. Même cas pour `User.lastSeenAt` et `emailConfirmedAt` des comptes existants à leur migration. La conversion relit donc en heure de Paris toute date comprise dans la durée d'exécution d'une migration, lue en heure de Paris, et le reste en UTC.

ADR :
- [ADR-0076](../../adr/ADR-0076-dates-avec-fuseau.md)

## Tests

Premier déploiement : `tests/integration/schema.test.ts` (une connexion reste en UTC sur une base en Europe/Paris, témoin sans le réglage) ; suites complètes. Second déploiement : le test du type des colonnes ; suites des délais (inscriptions, présences, copies des envois, inactivité) ; comparaison des instants avant et après sur une base en Europe/Paris.
