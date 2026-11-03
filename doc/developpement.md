# Développer Limbus

Guide technique : installation, vérifications, tests et déploiement. La présentation du produit est dans le [README](../README.md) ; le cycle de travail (fiche, spec, US, ADR) dans [`README.md`](README.md).

## Stack

Nuxt 4 · Nuxt UI 4 · Pinia · Prisma 7 / PostgreSQL · Nodemailer · pdf-lib · Vitest · Playwright. Node 24.

## Installation

Prérequis : Node 24 et une base PostgreSQL.

```bash
cp .env.example .env      # puis renseigner DATABASE_URL, JWT_SECRET, SMTP_ENCRYPTION_SECRET
npm install
npx prisma migrate dev    # crée le schéma
npm run user:create       # premier compte (rôle admin ou user)
npx prisma db seed        # données de démonstration (optionnel), confiées au premier compte
npm run dev               # http://localhost:3000
```

Le seed efface les données métier de la base avant de recréer ses jeux de démonstration.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `JWT_SECRET` | Signature des cookies de session. Le changer déconnecte tout le monde |
| `SMTP_ENCRYPTION_SECRET` | Chiffrement du mot de passe SMTP stocké en base (repli sur `JWT_SECRET`). Le changer oblige à ressaisir le mot de passe SMTP |
| `PUBLIC_APP_URL` | URL publique, obligatoire en production. Sert aux liens absolus dans les emails et PDF ; on ne se fie jamais aux en-têtes Host |
| `SIGNUP_OPEN` | `1` ouvre l'inscription libre ([ADR-0039](adr/ADR-0039-comptes-en-libre-service.md)). Absente : fermée, l'écran de connexion ne propose pas de créer un compte |

Le serveur SMTP se règle dans l'application (Administration → SMTP), pas par variable.

## Vérifications

```bash
npm run lint
npm run typecheck
npm test                  # unitaires (Vitest)
```

Le build, les tests d'intégration et Playwright demandent une base jetable, dont le nom doit contenir « test » car elle est vidée :

```bash
npm run build
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/limbus_test npm run test:integration
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/limbus_test npm run test:e2e   # après npx playwright install chromium
```

Sous Windows, `npm run build` échoue à l'étape de prérendu (« File URL path must be absolute ») : on passe par un conteneur Linux, par exemple l'image `mcr.microsoft.com/playwright` de la même version que `@playwright/test`. La stratégie de tests est décrite dans [ADR-0015](adr/ADR-0015-strategie-de-tests.md) et [ADR-0037](adr/ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md).

## Intégration continue et déploiement

- Chaque chantier a sa branche et sa pull request ; `main` n'accepte rien d'autre ([ADR-0017](adr/ADR-0017-branches-et-pull-requests.md)).
- La CI de la PR construit l'application dans le même environnement que le serveur (Debian 12, Node 24), la teste (contrôles statiques, intégration, Playwright, en jobs parallèles) et archive ce build ([ADR-0023](adr/ADR-0023-deploiement-sans-ci-redondante.md), [ADR-0059](adr/ADR-0059-ci-en-jobs-paralleles.md)).
- La fusion dans `main` déploie ce build testé tel quel, sans le reconstruire. Une PR qui ne touche que la documentation ne lance aucun test et ne déploie rien ([ADR-0022](adr/ADR-0022-pas-de-ci-pour-la-documentation.md)).
- Une migration ne doit pas casser la version encore en service pendant le déploiement ([ADR-0024](adr/ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).
- En production, l'application tourne derrière un reverse proxy HTTPS, dans un service système dédié. Les fichiers téléversés restent hors du dépôt. La base et les fichiers sont sauvegardés chaque jour, chiffrés, hors du serveur.
