---
id: ADR-0085
titre: Le serveur installe ses dépendances sans audit de sécurité, et note l'heure de chaque étape du déploiement
statut: accepté
date: 2026-11-11
liens: [ADR-0023]
---

# ADR-0085 : Le serveur installe ses dépendances sans audit de sécurité, et note l'heure de chaque étape du déploiement

Complète [ADR-0023](ADR-0023-deploiement-sans-ci-redondante.md). Fiche d'origine : [Un déploiement rapide quand les dépendances changent](../archive/todo/deploiement-dependances.md).

## Contexte

Le serveur reçoit le build testé par la CI, mais garde ses propres dépendances pour le client Prisma, les migrations et les scripts. Quand `package-lock.json` change, `deploy.sh` lance un `npm ci --include=dev` complet.

Au déploiement de #221, ce `npm ci` a pris 6 minutes ; ADR-0023 relevait 52 s. `deploy.sh` a alors noté l'heure de chaque étape, et `npm ci --timing` la durée de ses phases (#223). Mesure au déploiement de #222, dépendances changées :

- copie du dépôt : 1 s ;
- `npm ci` : 1 min 22 s, dont 36 s d'audit de sécurité, 47 s de téléchargement et d'extraction, 3 s de scripts d'installation ;
- client Prisma : 12 s ;
- build reçu, migrations, mise en place, redémarrage : 10 s ;
- total : environ 1 min 45.

Les 6 minutes ne se sont pas reproduites : un aléa du serveur ou du réseau, que la mesure ne permet pas d'attribuer. L'audit, lui, coûte 36 s à chaque installation et fait double emploi : la CI lance `npm audit --audit-level=high` sur chaque PR, et les alertes Dependabot sont actives sur le dépôt.

## Décision

1. `deploy.sh` installe avec `npm ci --include=dev --no-audit`.
2. `deploy.sh` garde l'heure de chaque étape dans le journal du job `deploy` (`[HH:MM:SS] étape`) : copie du dépôt, dépendances, client Prisma, build, migrations, mise en place, redémarrage, fin.
3. L'option `--timing`, qui servait à la mesure, est retirée.

## Conséquences

- Un déploiement qui change les dépendances prend environ une minute, l'objectif de la fiche ; une PR de code reste à quelques secondes (reprise de `node_modules`).
- Les failles connues des dépendances restent signalées par la CI et par les alertes Dependabot, plus par le serveur.
- Un nouveau ralentissement se lit directement dans le journal du job `deploy`, étape par étape.

## Options écartées

- **Ne rien changer** : 1 min 45 restait acceptable, mais l'audit ne sert à rien sur le serveur.
- **Envoyer les dépendances avec le build** : le serveur n'installerait plus rien, mais l'archive passerait de quelques Mo à plusieurs centaines, au-delà de la limite de 200 Mo, pour gagner une minute une fois par semaine.
- **N'installer que ce qui sert au serveur** : `nuxt prepare`, lancé à l'installation, a besoin des devDependencies (ADR-0023) ; séparer les deux demanderait de revoir l'installation pour un gain du même ordre que l'audit.
