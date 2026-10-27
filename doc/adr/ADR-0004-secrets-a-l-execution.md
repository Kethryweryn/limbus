---
id: ADR-0004
titre: Secrets lus à l'exécution, jamais figés au build
statut: accepté
date: 2026-10-27
liens: [ADR-0003]
---

# ADR-0004 : Secrets lus à l'exécution, jamais figés au build

*Rédigé a posteriori, pour une décision prise le 2026-10-27.*

## Contexte

`nuxt.config.ts` remplissait `runtimeConfig` avec `process.env.JWT_SECRET` et `process.env.SMTP_ENCRYPTION_SECRET`. Nuxt évalue cette configuration au build : les valeurs se retrouvaient en clair dans `.output/server/chunks/nitro/nitro.mjs`, lisible par tous les comptes du serveur. Le même jour, une archive contenant `.env` avait été publiée par erreur ; `JWT_SECRET` et le mot de passe PostgreSQL ont été changés.

## Décision

- `runtimeConfig` reste vide de tout secret dans `nuxt.config.ts`.
- Le code lit chaque secret à l'exécution : `useRuntimeConfig().x || process.env.X`.
- Les secrets ne vivent que dans `.env` (`root:600`, lu par systemd au démarrage du service).
- Le mot de passe SMTP est stocké chiffré en base (AES-256-GCM avec IV aléatoire ; la clé est le SHA-256 de `SMTP_ENCRYPTION_SECRET`).

## Conséquences

- Le build ne contient aucun secret et peut être produit sur n'importe quelle machine, dont la CI.
- Un secret manquant ne se voit qu'à l'exécution : le code doit échouer clairement (500 explicite) quand il est absent.
- Changer `SMTP_ENCRYPTION_SECRET` rend illisible le mot de passe SMTP stocké, qu'il faut alors ressaisir.

## Options écartées

- **Variables `NUXT_*` surchargeant `runtimeConfig`** : fonctionne aussi, mais la moindre valeur par défaut renseignée dans `nuxt.config.ts` serait figée au build ; la règle « jamais de `process.env` pour un secret dans `nuxt.config.ts` » est plus simple à vérifier.
