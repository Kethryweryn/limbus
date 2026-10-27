---
id: ADR-0001
titre: Documenter le projet dans doc/ (fiches, specs, epics/US, ADR)
statut: accepté
date: 2026-10-27
liens: []
---

# ADR-0001 : Documenter le projet dans `doc/`

## Contexte

Limbus a d'abord été développé sans trace des choix faits. Les fonctionnalités à venir (inscriptions, casting, copie de jeu) sont plus larges et se feront en plusieurs lots, sur plusieurs sessions de travail : il faut pouvoir reprendre une proposition, savoir ce qui a été décidé et pourquoi, et retrouver le lien entre une US, son code et ses tests.

## Décision

- La documentation vit dans le dépôt, sous `doc/`, en Markdown, versionnée avec le code.
- Une évolution suit le cycle fiche `todo/` → `SPEC-NNN` → epics et `US-NNN` → archive, décrit dans [`doc/README.md`](../README.md).
- Toute décision technique fait l'objet d'un ADR dans `doc/adr/`, jamais supprimé : un ADR remis en cause est remplacé par un nouveau.
- Chaque dossier a un index (`README.md`) tenu à jour dans le même commit que les fiches.
- Les commits d'implémentation citent l'US.

## Conséquences

- La documentation est relue et modifiée comme le code, et un `git log` sur une fiche montre son historique.
- Chaque évolution demande un peu plus d'écriture avant de coder ; c'est voulu.
- Les index doivent être tenus à la main ; si cela devient pénible, un script pourra les générer depuis les en-têtes YAML.

## Options écartées

- **Outil externe (Notion, GitHub Issues/Projects)** : sépare la documentation du code et de son historique, et n'est pas lisible hors ligne dans le dépôt.
- **Un seul document de conception** : devient vite illisible, et ne garde pas la trace des décisions abandonnées.
