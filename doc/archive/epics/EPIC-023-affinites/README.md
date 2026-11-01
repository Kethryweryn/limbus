---
id: EPIC-023
titre: Affinités rattachées, alertes et repères dans la sélection
statut: terminé
spec: ../../../specs/SPEC-001-inscriptions.md
date: 2026-11-01
---

# EPIC-023 : Affinités rattachées, alertes et repères dans la sélection

## Objectif

Lot 4 de [SPEC-001](../../../specs/SPEC-001-inscriptions.md) (R23 à R25) : l'équipe rattache chaque ligne d'affinité à une personne du jeu, aidée par des suggestions, et la sélection signale les personnes qui ne veulent pas se croiser dans une même session.

## Décisions

- On rattache une ligne à n'importe quelle personne du jeu : inscrites de toutes les périodes, cast, anciens joueurs.
- Limbus propose des personnes au nom proche, même quand le nom correspond exactement ; rien n'est rattaché sans l'équipe.
- Une ligne qui ne vise personne du jeu peut être marquée « inconnue ».
- « Ne pas croiser » et « ne pas jouer avec » donnent une alerte quand les deux personnes sont dans la même session, cast compris.
- L'alerte prévient sans bloquer, et le tirage n'en tient pas compte : elle s'affiche dans la sélection.
- « Avec qui je veux jouer » donne un repère : la personne souhaitée est retenue ici, ailleurs, ou pas encore.
- L'export des données d'une personne contient les affinités qu'elle a écrites, avec la personne rattachée, jamais celles des autres qui la visent.

## US

| US | Titre | Statut |
|---|---|---|
| [US-095](US-095-rattacher-les-affinites.md) | Rattacher les affinités à des personnes du jeu | terminée |
| [US-096](US-096-alertes-et-reperes.md) | Alertes et repères d'affinités dans la sélection | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0049](../../../adr/ADR-0049-rattachement-des-affinites.md).
