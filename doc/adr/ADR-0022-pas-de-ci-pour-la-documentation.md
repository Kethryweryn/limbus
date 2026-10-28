---
id: ADR-0022
titre: Pas de CI ni de déploiement quand seule la documentation change
statut: accepté, en partie remplacé par ADR-0023 (filtre et verdict dans le workflow pour les PR)
date: 2026-10-28
liens: [ADR-0002, ADR-0017, ADR-0001, ADR-0023]
---

# ADR-0022 : Pas de CI ni de déploiement quand seule la documentation change

## Contexte

Avec la documentation dans le dépôt ([ADR-0001](ADR-0001-documentation-du-projet.md)) et le travail par PR ([ADR-0017](ADR-0017-branches-et-pull-requests.md)), beaucoup de PR ne touchent que des fichiers Markdown : fiches, specs, US, ADR. Chacune lance pourtant toute la chaîne :

- la CI sur la PR, environ 2 minutes ;
- la CI sur `main` après la fusion, environ 2 minutes ;
- un déploiement complet ([ADR-0002](ADR-0002-deploiement-continu.md)), environ 3 min 20 : installation, build, migrations, redémarrage du service.

Le 2026-10-28, la PR #12, qui ne contenait que de la documentation, a déclenché un déploiement identique au précédent. Il a retardé de plus de 3 minutes celui des PR de code qui suivaient, puisque les déploiements s'exécutent l'un après l'autre.

## Décision

- Le workflow `.github/workflows/ci.yml` ignore les changements qui ne portent que sur la documentation, sur les PR comme sur `main` (`paths-ignore`) :
  - `doc/**` ;
  - les fichiers `*.md` à la racine (`README.md`, `CLAUDE.md`).
- Dès qu'un autre fichier change dans le même push ou la même PR, la CI et le déploiement tournent normalement.

## Conséquences

- Une PR de documentation se fusionne sans attendre de CI, et ne retarde plus les déploiements.
- Une PR de documentation n'affiche aucune vérification dans GitHub. C'est normal : il n'y a rien à tester.
- Si une règle de protection de branche exige un jour des vérifications pour fusionner, ces PR seraient bloquées en attente. Il faudrait alors remplacer `paths-ignore` par un filtre à l'intérieur du workflow, qui produit une vérification réussie sans rien exécuter.
- Si un fichier Markdown devient un jour lu par l'application ou par le build, il devra sortir de cette liste.

## Options écartées

- **Garder la CI mais sauter seulement le déploiement**, avec un filtre de chemins dans le job `deploy` : on économiserait le déploiement mais pas les deux CI, et il faudrait une action tierce ou un script de comparaison.
- **Mot-clé `[skip ci]` dans le message de commit** : il dépend d'un oubli humain, et le message d'un squash-merge vient du titre de la PR.
