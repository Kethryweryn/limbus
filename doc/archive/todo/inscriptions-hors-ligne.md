---
titre: Page Inscriptions lisible hors ligne
statut: archivée
epic: ../epics/EPIC-032-inscriptions-hors-ligne/README.md
date: 2026-11-02
---

# Page Inscriptions lisible hors ligne

## Besoin

La revue de la PR [#95](https://github.com/Kethryweryn/limbus/pull/95) (EPIC-031, lot 4) relève que la page Inscriptions ne suit pas la règle des pages de liste : elle ne se lit pas depuis l'appareil hors ligne. Les autres listes se lisent hors ligne ([SPEC-010](../../specs/SPEC-010-hors-ligne.md)).

Les inscriptions ne font pas partie des données gardées hors ligne. Sur le lieu du GN, sans réseau, l'équipe ne peut donc pas consulter qui est inscrit, retenu, en liste d'attente ou désisté, ni le détail d'une inscription (coordonnées, allergies, affinités).

## Proposition

La page Inscriptions et le détail d'une inscription gardent leur dernière version sur l'appareil, comme les autres listes. Hors ligne, ils s'affichent depuis cette copie, en lecture seule. Les actions (invitations, relances, sélection, tirage, annonces) restent impossibles hors ligne : ce sont des envois.

## Découpage envisagé

1. Lecture hors ligne de la page Inscriptions (périodes et inscriptions).
2. Lecture hors ligne du détail d'une inscription.

## Décisions

2026-11-02, choix de l'utilisatrice :

- Le détail d'une inscription ouverte avec le réseau est gardé en entier sur l'appareil, allergies et affinités comprises, comme la fiche allergies d'une session. La déconnexion l'efface ([ADR-0012](../../adr/ADR-0012-donnees-hors-ligne.md)).
- La sélection se lit aussi hors ligne : retenus, listes d'attente, vivier et journal des tirages.
- Les boutons d'action restent visibles, comme sur les autres pages : hors ligne, un clic échoue avec un message.

Mis en œuvre par [EPIC-032](../epics/EPIC-032-inscriptions-hors-ligne/README.md) (US-119, US-120). Fiche archivée le 2026-11-02.
