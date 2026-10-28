---
titre: Revue d'architecture comparée à l'état de l'art
statut: à trancher
date: 2026-10-29
---

# Revue d'architecture comparée à l'état de l'art

## Besoin

Les revues de code faites jusqu'ici portent sur une PR à la fois : elles cherchent des bugs et des failles dans un diff. Personne n'a encore regardé le projet dans son ensemble pour savoir si son organisation tient la route face aux pratiques actuelles d'une application Nuxt 4 / Prisma / PostgreSQL : découpage du code, accès aux données, sécurité, hors ligne, tests, déploiement. Sans ce recul, une dette d'architecture peut s'installer sans qu'aucune PR ne la montre.

## Proposition

Une revue ponctuelle de l'architecture, appuyée sur des sources récentes (documentation officielle Nuxt, Nitro, Prisma, guides OWASP, retours d'expérience publiés), qui compare chaque grand choix du projet à ce qui se fait aujourd'hui.

Axes envisagés :

- **Structure du code** : `server/api`, `server/utils`, composables, stores Pinia, composants ; taille et responsabilités des fichiers, doublons.
- **Accès aux données** : usage de Prisma (transactions, requêtes N+1, index), filtrage par jeu (`gameScopedWhere`, `requireGameAccess`), migrations.
- **Sécurité** : authentification (JWT en cookie, révocation), autorisations, validation zod, fichiers téléversés, rate limiting, en-têtes.
- **Hors ligne / PWA** : stockage local, file d'écritures, stratégie de cache.
- **Tests et CI** : répartition unitaires / intégration / e2e, couverture des cas de droits.
- **Exploitation** : déploiement, sauvegardes, journalisation.

Livrable : un rapport dans `doc/` qui, pour chaque axe, dit ce qui est conforme, ce qui s'en écarte (avec la source), et une recommandation chiffrée en effort. Chaque recommandation retenue devient ensuite une fiche todo ou un ADR ; la revue elle-même ne modifie pas le code.

## Découpage envisagé

1. Recherche de l'état de l'art par axe, sources citées.
2. Lecture du projet axe par axe et rapport.
3. Tri des recommandations avec l'utilisatrice : fiches todo, ADR, ou abandon motivé.

## Points à trancher

- Où ranger le rapport ? Recommandation : `doc/revues/AAAA-MM-JJ-architecture.md`, nouveau dossier avec son index, plutôt qu'un ADR (un ADR acte une décision, pas un constat).
- Tous les axes, ou d'abord les plus risqués ? Recommandation : sécurité et accès aux données d'abord, puis le reste.
- Les points déjà écartés volontairement (CSP, supervision, etc.) sont-ils réexaminés ou simplement listés comme choix assumés ? Recommandation : listés, sans recommandation nouvelle sauf fait nouveau.
