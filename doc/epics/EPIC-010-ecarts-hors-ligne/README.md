---
id: EPIC-010
titre: Corriger les écarts du mode hors ligne
statut: en cours
spec: ../../specs/SPEC-010-hors-ligne.md
date: 2026-10-29
---

# EPIC-010 : Corriger les écarts du mode hors ligne

## Objectif

Corriger les cinq écarts de [SPEC-010](../../specs/SPEC-010-hors-ligne.md), avec les choix faits par l'utilisatrice le 29 octobre 2026 : session disponible et modifiable hors ligne, panneau des modifications en attente, contrôle et résolution des conflits, déconnexion sans réseau, sous-routes et envoi à l'ouverture. Reprend la fiche [Resynchronisation hors ligne](../../todo/resynchronisation-hors-ligne.md).

## US

| US | Titre | Statut |
|---|---|---|
| [US-047](US-047-session-consultable-hors-ligne.md) | Une session consultée reste disponible hors ligne | à faire |
| [US-048](US-048-modifier-une-session-hors-ligne.md) | Modifier une session hors ligne | à faire |
| [US-049](US-049-panneau-des-modifications-en-attente.md) | Le panneau des modifications en attente | à faire |
| [US-050](US-050-conflit-a-la-resynchronisation.md) | Contrôler et résoudre les conflits à la resynchronisation | à faire |
| [US-051](US-051-deconnexion-sans-reseau.md) | Se déconnecter sans réseau | à faire |
| [US-052](US-052-envoi-a-l-ouverture.md) | La file part à l'ouverture de l'application | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- SPEC-010 à jour ; fiche Resynchronisation hors ligne archivée.
- [ADR-0036](../../adr/ADR-0036-protocole-de-resynchronisation.md).
