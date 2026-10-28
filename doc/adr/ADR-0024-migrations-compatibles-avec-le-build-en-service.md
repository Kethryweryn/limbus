---
id: ADR-0024
titre: Migrations compatibles avec le build en service, vérifiées par la CI
statut: accepté
date: 2026-10-28
liens: [ADR-0002, ADR-0023]
---

# ADR-0024 : Migrations compatibles avec le build en service, vérifiées par la CI

## Contexte

`deploy.sh` applique les migrations Prisma avant de basculer sur le nouveau build et de redémarrer le service ([ADR-0002](ADR-0002-deploiement-continu.md)). Pendant ce court intervalle, l'ancien build sert encore les requêtes avec le nouveau schéma. ADR-0002 notait déjà qu'une migration doit rester compatible avec le build précédent, mais rien ne le vérifiait : une colonne supprimée ou renommée ferait échouer les requêtes de l'ancien build jusqu'au redémarrage.

## Décision

- Le job `changes` de la CI examine les migrations ajoutées ou modifiées par la PR. Il refuse celles qui suppriment une colonne ou une table, renomment, rendent une colonne obligatoire (`SET NOT NULL`) ou changent son type.
- Une telle migration se découpe en deux déploiements : d'abord le code qui n'utilise plus l'ancienne forme, puis la migration qui la retire.
- Quand l'interruption est acceptée (production sans données réelles, jeu hors session), la migration porte un commentaire `-- deploiement-incompatible : <raison>`, et la CI la laisse passer.

## Conséquences

- Le risque est visible au moment de la revue de la PR, plus en production.
- La détection repose sur des mots-clés SQL : elle peut laisser passer un cas non listé (par exemple une contrainte ajoutée), ou bloquer une migration sans risque. Le commentaire explicite sert dans ce dernier cas.
- Les migrations déjà appliquées ne sont pas concernées : seule la PR en cours est examinée.

## Options écartées

- **Migrer après le redémarrage** : le nouveau build démarrerait sur l'ancien schéma, ce qui casse dans l'autre sens.
- **Arrêter le service pendant la migration** : interruption à chaque déploiement, même sans migration risquée.
