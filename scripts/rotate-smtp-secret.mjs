// Rotation de SMTP_ENCRYPTION_SECRET (revue d'architecture du 2026-10-29, R-05), à lancer sur le serveur en root :
//   ssh limbus 'node /var/www/limbus/scripts/rotate-smtp-secret.mjs && systemctl restart limbus'
// Rechiffre le mot de passe SMTP avec un nouveau secret, puis écrit ce secret dans .env (copie de l'ancien : .env.bak-AAAAMMJJ).
// N'affiche jamais ni le secret ni le mot de passe : le nouveau secret se lit ensuite dans .env pour être sauvegardé.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, copyFileSync, chmodSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire('/var/www/limbus/package.json')
const { Client } = require('pg')

const ENV = '/var/www/limbus/.env'
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const env = readFileSync(ENV, 'utf8')
const read = (name) => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.replace(/^["']|["']$/g, '')

const oldSecret = read('SMTP_ENCRYPTION_SECRET') || read('JWT_SECRET')
const databaseUrl = read('DATABASE_URL')
if (!oldSecret || !databaseUrl) throw new Error('Variables manquantes dans .env')

const key = (secret) => createHash('sha256').update(secret).digest()
function decrypt(payload, secret) {
  const [iv, tag, data] = payload.split(':')
  const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}
function encrypt(text, secret) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv)
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join(':')
}

const newSecret = randomBytes(48).toString('base64url')
const client = new Client({ connectionString: databaseUrl })
await client.connect()
try {
  await client.query('BEGIN')
  const { rows } = await client.query('SELECT "passwordEncrypted" FROM "SmtpSettings" WHERE id = $1 FOR UPDATE', ['default'])
  const current = rows[0]?.passwordEncrypted
  if (current) {
    const password = decrypt(current, oldSecret)
    const reencrypted = encrypt(password, newSecret)
    if (decrypt(reencrypted, newSecret) !== password) throw new Error('Vérification du rechiffrement échouée')
    await client.query('UPDATE "SmtpSettings" SET "passwordEncrypted" = $1 WHERE id = $2', [reencrypted, 'default'])
    console.log('Mot de passe SMTP rechiffré')
  } else {
    console.log('Aucun mot de passe SMTP enregistré : rien à rechiffrer')
  }

  // .env écrit avant la validation : en cas d'échec d'écriture, la base n'est pas modifiée
  copyFileSync(ENV, `${ENV}.bak-${stamp}`)
  chmodSync(`${ENV}.bak-${stamp}`, 0o600)
  const updated = env.match(/^SMTP_ENCRYPTION_SECRET=/m)
    ? env.replace(/^SMTP_ENCRYPTION_SECRET=.*$/m, `SMTP_ENCRYPTION_SECRET=${newSecret}`)
    : `${env.trimEnd()}\nSMTP_ENCRYPTION_SECRET=${newSecret}\n`
  writeFileSync(ENV, updated, { mode: 0o600 })
  await client.query('COMMIT')
  console.log(`Nouveau secret écrit dans .env (ancienne version : .env.bak-${stamp})`)
} catch (error) {
  await client.query('ROLLBACK')
  writeFileSync(ENV, env, { mode: 0o600 })
  throw error
} finally {
  await client.end()
}
