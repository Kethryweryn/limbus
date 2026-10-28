---
id: ADR-0017
titre: Travail par branches et pull requests, fusion dans main pour déployer
statut: accepté, complété par ADR-0023 (protection de main, déploiement du build testé sans nouvelle CI)
date: 2026-10-27
liens: [ADR-0002, ADR-0001, ADR-0023]
---

# ADR-0017 : Travail par branches et pull requests, fusion dans `main` pour déployer

## Contexte

[ADR-0002](ADR-0002-deploiement-continu.md) prévoyait de travailler directement sur `main`. Avec la documentation par epics et US ([ADR-0001](ADR-0001-documentation-du-projet.md)), l'historique de `main` mélange des commits de nature différente. Il devient difficile de suivre ce qui a été livré pour quelle US.

## Décision

- On ne pousse plus directement sur `main` : chaque chantier (une US, un ensemble cohérent de documentation, une correction) a sa branche et sa pull request.
- Nom de branche : `<type>/<sujet>`, par exemple `us/us-003-inviter-des-participants`, `doc/epic-001-campagne-invitation`, `fix/…`, `deps/…`.
- La description de la PR cite les US, specs et ADR concernés.
- La CI tourne sur chaque PR ; on ne fusionne qu'une PR dont la CI est verte, en squash (un commit par PR sur `main`).
- La fusion dans `main` déclenche le déploiement, comme avant ([ADR-0002](ADR-0002-deploiement-continu.md)).

Cet ADR remplace la règle « on travaille directement sur `main` » de l'ADR-0002 ; le reste de l'ADR-0002 (déploiement après une CI verte sur `main`) reste valable.

## Conséquences

- Chaque livraison est lisible dans GitHub : une PR, sa description, sa CI, ses commits.
- La CI tourne deux fois par changement (sur la PR, puis sur `main` après la fusion) ; c'est le prix de la sécurité, puisque `main` peut avoir avancé entre-temps.
- Rien n'empêche techniquement un push direct sur `main` : une règle de protection de branche dans GitHub (CI obligatoire avant fusion) l'imposerait.

## Options écartées

- **Rester sur `main`** : la décision précédente, abandonnée pour la lisibilité du suivi.
- **Fusion par merge commit** : garde tous les commits intermédiaires dans `main` ; le squash donne un commit par PR, relié à sa PR.
