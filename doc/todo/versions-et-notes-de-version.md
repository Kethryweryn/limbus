---
titre: Numéros de version et notes de version
statut: à trancher
date: 2026-10-29
---

# Numéros de version et notes de version

## Besoin

Limbus n'a ni numéro de version (`package.json` n'en déclare pas), ni étiquette git, ni journal des changements. Chaque fusion dans `main` part en production ([ADR-0023](../adr/ADR-0023-deploiement-sans-ci-redondante.md)) sans que les personnes qui utilisent l'application sachent ce qui a changé. L'utilisatrice veut des numéros de version et des notes de version, une fois la première version publiée.

## Proposition

- **Première version** : choisir le moment où Limbus est assez complet pour être annoncé, et le marquer comme version 1.0.0.
- **Numéros de version** : version sémantique (majeure.mineure.correctif), portée par `package.json` et une étiquette git `vX.Y.Z` sur le commit publié.
- **Notes de version** : pour chaque version, ce qui change pour les personnes qui utilisent Limbus, en français, sans vocabulaire technique. Elles sont rédigées à partir des US et des correctifs fusionnés depuis la version précédente.
- **Affichage** : le numéro de version dans l'application (pied de page ou menu), et une page « Nouveautés » qui reprend les notes.

## Découpage envisagé

1. Numéro de version dans `package.json`, étiquette git et notes dans un fichier du dépôt.
2. Affichage du numéro et page « Nouveautés » dans l'application.

## Points à trancher

- Quand faire la première version, et qu'est-ce qui doit être fait avant ?
- Une version à chaque fusion déployée, ou des versions regroupées, publiées quand on le décide ? Avec le déploiement continu, une version regroupée veut dire que des changements sont en production avant d'être dans une note.
- Qui rédige les notes, et quand : à chaque PR (une ligne dans un fichier « à venir »), ou au moment de la version ?
- Où les publier : fichier du dépôt (`CHANGELOG.md`), page dans l'application, release GitHub, ou plusieurs ?
- Faut-il prévenir les organisatrices d'une nouvelle version (bandeau à la connexion, email) ?
