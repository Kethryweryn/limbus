# Deploiement

## Variables d'environnement

En production, `npm run start` ne charge pas automatiquement `.env`.

Variables requises au runtime :

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB"
JWT_SECRET="change-me"
```

Ne pas committer les vraies valeurs.

## Build

Depuis le dossier du projet :

```bash
npm install
npm run build
```

## Demarrage

Charger `.env` avant de lancer Nuxt :

```bash
set -a
source .env
set +a
npm run start
```

## Verification

```bash
node -e "console.log(process.env.DATABASE_URL ? 'DATABASE_URL ok' : 'DATABASE_URL missing')"
node -e "console.log(process.env.JWT_SECRET ? 'JWT_SECRET ok' : 'JWT_SECRET missing')"
```

## Test public temporaire

Lancer l'application, puis exposer le port 3000 avec ngrok :

```bash
ngrok http 3000
```

Pour limiter les scans automatiques pendant les tests :

```bash
ngrok http 3000 --basic-auth="user:password"
```
