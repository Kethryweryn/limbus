---
id: EPIC-030
titre: Durées de conservation des comptes et des fiches participant
statut: terminé
spec: ../../../specs/SPEC-013-pages-legales-et-conservation.md
date: 2026-11-02
---

# EPIC-030 : Durées de conservation des comptes et des fiches participant

## Objectif

[SPEC-013](../../../specs/SPEC-013-pages-legales-et-conservation.md), règle L6, et écart 3 de [SPEC-007](../../../specs/SPEC-007-participants-et-rgpd.md). Aucun compte ni aucune fiche n'est gardé indéfiniment, comme l'annonce la politique de confidentialité. Livré dans la même PR qu'[EPIC-029](../EPIC-029-pages-legales/README.md), pour que la politique ne promette rien que Limbus ne fasse.

## US

| US | Titre | Statut |
|---|---|---|
| [US-112](US-112-comptes-inactifs.md) | Effacer les comptes sans connexion depuis deux ans, après un avertissement | terminée |
| [US-113](US-113-fiches-sans-compte.md) | Effacer les fiches participant sans compte trois ans après leur dernière activité | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0056](../../../adr/ADR-0056-durees-de-conservation.md).
