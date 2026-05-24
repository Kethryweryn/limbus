# Deploiement

## Variables d'environnement

En production, `npm run start` ne charge pas automatiquement `.env`.

Variables requises au runtime :

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB"
JWT_SECRET="change-me"
SMTP_ENCRYPTION_SECRET="change-me-too"
```

Ne pas committer les vraies valeurs.

`SMTP_ENCRYPTION_SECRET` sert a chiffrer le mot de passe SMTP en base. Si elle est absente, Limbus utilise `JWT_SECRET`, mais une valeur dediee est preferable.

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
node -e "console.log(process.env.SMTP_ENCRYPTION_SECRET ? 'SMTP_ENCRYPTION_SECRET ok' : 'SMTP_ENCRYPTION_SECRET missing')"
```

## Donnees runtime

Les photos uploadees pour les assignations de session sont stockees dans :

```bash
.data/uploads/session-assignment-photos
```

Ce dossier est ignore par Git. Il doit etre conserve par les sauvegardes et ne doit pas etre supprime lors d'un redeploiement.

## Test public temporaire

Lancer l'application, puis exposer le port 3000 avec ngrok :

```bash
ngrok http 3000
```

Pour limiter les scans automatiques pendant les tests :

```bash
ngrok http 3000 --basic-auth="user:password"
```
