---
id: EPIC-062
titre: Le bandeau de nouvelle version en haut de la page
statut: terminé
spec: ../../../specs/SPEC-010-hors-ligne.md
origine: ../../../specs/SPEC-010-hors-ligne.md
date: 2026-11-18
---

# EPIC-062 : Le bandeau de nouvelle version en haut de la page

## Objectif

Le bandeau qui propose une nouvelle version s'affiche tout en haut de la page, au-dessus de la barre du logo, comme les bandeaux de connexion, et non plus en bas de l'écran (R14 de [SPEC-010](../../../specs/SPEC-010-hors-ligne.md), note du 2026-11-18 d'[ADR-0093](../../../adr/ADR-0093-mise-a-jour-par-bandeau.md)). Demande de l'utilisatrice du 2026-11-18.

## US

| US | Titre | Statut |
|---|---|---|
| [US-256](US-256-bandeau-en-haut.md) | Voir la nouvelle version annoncée en haut de la page | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-18 : US-256 déployée (PR #265, déploiement n° 265).
- Ce que la revue de code a changé : la zone annoncée aux lecteurs d'écran reste dans la page, vide sans version qui attend, pour que son texte soit lu quand il apparaît ; ADR-0093 renvoie à sa note dans la section Décision.
- Limite connue, acceptée par l'utilisatrice : comme les bandeaux de connexion, le bandeau ajoute sa hauteur aux pages pleine hauteur (chargement, connexion, pages publiques), qui défilent alors de cette hauteur.
- Non vérifié sur l'appareil de l'utilisatrice : le bandeau en haut après un vrai déploiement.
