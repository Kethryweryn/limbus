# Limbus

Outil d'organisation de jeux de rôle grandeur nature (GN), en ligne sur <https://limbuslarp.fr>.

Il couvre deux besoins :

- **l'écriture d'un jeu** : personnages, factions, intrigues, objets, documents, chronologie. Tout est centralisé pour faciliter l'écriture, la relecture et la cohérence ;
- **l'organisation des sessions** : une session associe un jeu, une date, un lieu, des participants et le casting (participant ↔ personnage). Elle produit les trombinoscopes, les feuilles de personnage en PDF, les envois d'emails (documents, paiements) et une chronologie de déroulé.

Les participants portent les informations stables (nom, email, téléphone) et peuvent être inscrits à plusieurs jeux. La photo dépend de l'assignation à un personnage pour une session donnée, pour correspondre au rôle incarné.

Un jeu peut être partagé avec d'autres organisateurs par invitation email. Depuis le menu utilisateur, on peut fermer sa session sur tous ses appareils ; un changement de mot de passe le fait aussi.

Données personnelles (RGPD) : la fiche d'un participant permet d'exporter ses données en JSON (droit d'accès), limitées aux jeux de l'organisateur. Le supprimer efface ses coordonnées, paiements, envois et photos, fichiers compris. Les trombinoscopes qui contenaient sa photo sont supprimés et doivent être régénérés. L'application est une PWA : en cas de coupure réseau, elle reste consultable en lecture.

## Stack

Nuxt 4 · Nuxt UI 4 · Pinia · Prisma 7 / PostgreSQL · Nodemailer · pdf-lib · Vitest. Node 24.

## Développement

Prérequis : Node 24 et une base PostgreSQL.

```bash
cp .env.example .env      # puis renseigner DATABASE_URL, JWT_SECRET, SMTP_ENCRYPTION_SECRET
npm install
npx prisma migrate dev    # crée le schéma
npx prisma db seed        # données de démonstration (optionnel)
npm run user:create       # premier compte (admin ou organizer)
npm run dev               # http://localhost:3000
```

Vérifications (lancées aussi par la CI GitHub à chaque push) :

```bash
npm run lint
npm run typecheck
npm test
npm run build
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/limbus_test npm run test:integration
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/limbus_test npm run test:e2e   # Playwright (npx playwright install chromium)
```

Les tests d'intégration vident la base indiquée : son nom doit contenir « test ».

Sous Windows, `npm run build` échoue à l'étape de prérendu (« File URL path must be absolute »). C'est une limite de l'environnement : le build est vérifié sous Linux par la CI.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `JWT_SECRET` | Signature des cookies de session. Le changer déconnecte tout le monde |
| `SMTP_ENCRYPTION_SECRET` | Chiffrement du mot de passe SMTP stocké en base (repli sur `JWT_SECRET`). Le changer oblige à ressaisir le mot de passe SMTP |
| `PUBLIC_APP_URL` | URL publique, obligatoire en production. Sert aux liens absolus dans les emails et PDF ; on ne se fie jamais aux en-têtes Host |

## Production

Serveur Debian derrière Apache (reverse proxy HTTPS). L'application tourne sous l'utilisateur système `limbus`, dans un service systemd durci, et n'écoute que sur `127.0.0.1:3000`.

- **Déployer** : automatique après chaque push sur `main` dont la CI passe. À la main : `/var/www/limbus/deploy.sh` (en root). Le script fait `git pull`, construit dans un dossier temporaire, applique les migrations, remplace `.output` puis redémarre le service. L'ancienne version reste dans `.output-prev`.
- **(Ré)installer le service** : `install-service.sh`.
- **Créer un compte ou changer un mot de passe** : `cd /var/www/limbus && npm run user:create`.
- **Données runtime** : les uploads (photos, RIB) sont dans `.data/uploads`, hors Git, et ne doivent jamais être supprimés au déploiement. Le `.env` est en `root:600` : systemd le lit avant de passer à l'utilisateur `limbus`.
- **Sauvegardes** : chaque jour, chiffrées avec age, envoyées hors du serveur (voir `/etc/sauvegarde/RESTAURATION.txt` sur le serveur).
