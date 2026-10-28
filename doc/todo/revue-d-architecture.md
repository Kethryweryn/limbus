---
titre: Revue d'architecture comparée à l'état de l'art
statut: prête
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

Livrable : un rapport dans `doc/revues/AAAA-MM-JJ-architecture.md` (nouveau dossier, avec son index) qui, pour chaque axe, dit ce qui est conforme, ce qui s'en écarte (avec la source), et une recommandation chiffrée en effort. Chaque recommandation retenue devient ensuite une fiche todo ou un ADR ; la revue elle-même ne modifie pas le code.

## Découpage envisagé

1. Recherche de l'état de l'art par axe, sources citées.
2. Lecture du projet axe par axe et rapport unique, en commençant par la sécurité et l'accès aux données, puis structure du code, hors ligne, tests et CI, exploitation.
3. Tri des recommandations avec l'utilisatrice, une par une : fiche todo, ADR, ou abandon motivé noté dans le rapport.

## Décisions

- 2026-10-29 : rapport rangé dans `doc/revues/`, un constat daté distinct des décisions (ADR) et des specs.
- 2026-10-29 : un seul rapport couvrant les six axes, risques d'abord (sécurité, accès aux données).
- 2026-10-29 : les points déjà écartés sont réexaminés comme les autres, comparés à l'état de l'art, et peuvent être recommandés à nouveau, arguments et sources à l'appui. À ce jour :
  - consentement explicite des participants pour les photos ;
  - purge automatique des photos après une session ;
  - en-tête Content-Security-Policy ;
  - lien magique pour que les participants consultent leurs données ;
  - désactivation de l'authentification SSH par mot de passe sur le serveur ;
  - rotation de `SMTP_ENCRYPTION_SECRET` ;
  - supervision (monitoring) de la production ;
  - listage du répertoire `/files/` du serveur.
- 2026-10-29 : chaque recommandation est triée avec l'utilisatrice avant toute suite ; la revue elle-même ne modifie pas le code.
- 2026-10-29 : pas de spec : une revue est un constat ponctuel, pas une fonctionnalité. La PR du rapport ajoute `revues/` à l'arborescence de `doc/README.md`, et archive cette fiche dans `archive/todo/` avec un lien vers le rapport.
