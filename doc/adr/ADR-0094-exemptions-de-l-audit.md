---
id: ADR-0094
titre: L'audit de la CI peut exempter un avis nommé, sans correctif, qui ne touche pas le serveur en service
statut: accepté
date: 2026-11-17
liens: [ADR-0016-mises-a-jour-des-dependances.md, ADR-0085-installation-serveur-sans-audit.md]
---

# ADR-0094 : L'audit de la CI peut exempter un avis nommé, sans correctif, qui ne touche pas le serveur en service

## Contexte

La CI lance `npm audit --audit-level=high` sur chaque PR ([ADR-0016](ADR-0016-mises-a-jour-des-dependances.md)) : un avis grave bloque la fusion. Le 2026-11-17, l'avis [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (picomatch, ReDoS par un motif de fichiers piégé, CVSS 8,7) vise toutes les versions jusqu'à la 4.0.7, sans version corrigée. Il bloque toutes les PR de code.

Vérifié dans Limbus : picomatch n'est pas dans le serveur en service (`.output/server` ne contient ni picomatch, ni micromatch, ni minimatch), et le code de Limbus ne l'appelle pas. Il ne sert qu'aux outils de build (Nuxt, Nitro, Vite, ESLint, workbox-build), avec des motifs écrits dans leur configuration ou dans le code, jamais saisis par quelqu'un.

## Décision

- La CI lance `node scripts/audit.mjs` à la place de `npm audit --audit-level=high`. Le script lit `npm audit --json` et échoue sur tout avis grave ou critique, sauf ceux de sa liste d'exemptions, nommés par leur adresse, chacun avec sa raison.
- Une exemption n'est admise que pour un avis sans version corrigée, dont le paquet n'est pas dans le serveur en service, sur l'accord de l'utilisatrice.
- Une exemption devenue inutile fait échouer le script : quand l'avis disparaît de l'audit (version corrigée installée), on la retire.
- Première exemption : GHSA-fc5q-39xc-vjpf (picomatch), accordée par l'utilisatrice le 2026-11-17.

## Conséquences

- Les PR se fusionnent de nouveau. Tout autre avis grave bloque comme avant.
- L'audit ne signalerait pas qu'une future version de Limbus se met à appeler picomatch avec un motif saisi par quelqu'un : une revue de code qui ajoute un tel appel doit le relever.
- Quand picomatch publie un correctif, Dependabot propose la mise à jour, l'avis disparaît, et le script demande de retirer l'exemption.

## Options écartées

- **Attendre un correctif** : aucune PR de code ne pouvait être fusionnée ni déployée, sans date annoncée.
- **`npm audit --omit=dev`** : picomatch est aussi tiré par des dépendances de production (Nuxt, `@nuxt/icon`), l'avis resterait.
- **`npm audit fix --force`** : il propose de revenir à Nuxt 4.3.1, une régression sans corriger l'avis.
