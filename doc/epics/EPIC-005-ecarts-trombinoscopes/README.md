---
id: EPIC-005
titre: Corriger les écarts des trombinoscopes
statut: en cours
spec: ../../specs/SPEC-005-trombinoscopes-et-pdf.md
date: 2026-10-29
---

# EPIC-005 : Corriger les écarts des trombinoscopes

## Objectif

Aligner le code sur [SPEC-005](../../specs/SPEC-005-trombinoscopes-et-pdf.md) : corriger ses trois écarts, avec les choix faits par l'utilisatrice le 29 octobre 2026.

## US

| US | Titre | Statut |
|---|---|---|
| [US-026](US-026-photo-de-la-session-d-abord.md) | La photo de la personne qui joue le rôle passe avant la photo par défaut | terminée |
| [US-027](US-027-jamais-dans-son-propre-trombinoscope.md) | Un personnage n'apparaît jamais dans son propre trombinoscope | à faire |
| [US-028](US-028-trombinoscopes-perimes.md) | Signaler les trombinoscopes périmés et bloquer leur envoi | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- SPEC-005 à jour : les écarts corrigés sortent de la liste, les règles décrivent le nouveau comportement.
- [ADR-0030](../../adr/ADR-0030-empreinte-d-un-trombinoscope.md).
