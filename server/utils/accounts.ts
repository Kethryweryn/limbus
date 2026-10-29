import bcrypt from 'bcrypt'
import { randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { getSmtpSettings } from '~/server/utils/email'
import { createRegistrationToken, hashRegistrationToken } from '~/server/utils/registrations'

// Liens de compte à usage unique (ADR-0039)
export const ACCOUNT_TOKEN_KINDS = {
  confirm: 'confirm',
  email: 'email',
  password: 'password'
} as const
type AccountTokenKind = typeof ACCOUNT_TOKEN_KINDS[keyof typeof ACCOUNT_TOKEN_KINDS]

const HOUR = 60 * 60 * 1000
export const ACCOUNT_TOKEN_TTL = {
  confirm: 48 * HOUR,
  email: 48 * HOUR,
  passwordForgotten: HOUR,
  passwordCreated: 7 * 24 * HOUR
}
const UNCONFIRMED_ACCOUNT_LIFETIME = 7 * 24 * HOUR

// Inscription libre (R4) : fermée tant que SIGNUP_OPEN ne vaut pas 1, lu à l'exécution
export function isSignupOpen() {
  return process.env.SIGNUP_OPEN === '1'
}

export const BCRYPT_ROUNDS = 10

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, BCRYPT_ROUNDS)
}

// Mot de passe que personne ne connaît : le compte attend le lien pour en choisir un (US-065)
export async function unusablePassword() {
  return await hashPassword(randomBytes(32).toString('base64url'))
}

export function confirmUrl(token: string) {
  return absoluteAppUrl(`/acces/confirmer/${token}`)
}

export function passwordUrl(token: string) {
  return absoluteAppUrl(`/acces/mot-de-passe/${token}`)
}

export function passwordForgottenUrl() {
  return absoluteAppUrl('/acces/mot-de-passe-oublie')
}

// Les liens de compte partent par email : sans envoi, l'action n'a pas de sens
export async function assertEmailEnabled() {
  if (!(await getSmtpSettings())?.enabled) {
    throw createError({ statusCode: 503, message: 'L’envoi d’emails est désactivé : impossible d’envoyer le lien. Prévenez l’administratrice.' })
  }
}

// Un nouveau lien remplace les liens non utilisés du même type
export async function createAccountToken(userId: string, kind: AccountTokenKind, ttlMs: number, email?: string) {
  const { token, tokenHash } = createRegistrationToken()
  await prisma.$transaction([
    prisma.accountToken.deleteMany({ where: { userId, kind, usedAt: null } }),
    prisma.accountToken.create({ data: { userId, kind, tokenHash, email: email ?? null, expiresAt: new Date(Date.now() + ttlMs) } })
  ])
  return token
}

/**
 * Consomme un lien : valable, du bon type, jamais utilisé. Le marquage est conditionnel,
 * deux clics simultanés ne passent pas tous les deux.
 */
export async function consumeAccountToken(token: string, kinds: AccountTokenKind[]) {
  const record = await prisma.accountToken.findUnique({ where: { tokenHash: hashRegistrationToken(token) } })
  if (!record || !(kinds as string[]).includes(record.kind) || record.usedAt) {
    throw createError({ statusCode: 400, message: 'Ce lien n’est plus valable : il a déjà servi ou a été remplacé par un plus récent.' })
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 400, message: 'Ce lien a expiré : demandez-en un nouveau.' })
  }
  const { count } = await prisma.accountToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } })
  if (!count) {
    throw createError({ statusCode: 400, message: 'Ce lien a déjà servi.' })
  }
  return record
}

// Comptes jamais confirmés, supprimés au bout de 7 jours (R5) : appelé à l'inscription et à la connexion
export async function purgeUnconfirmedAccounts() {
  await prisma.user.deleteMany({
    where: { emailConfirmedAt: null, createdAt: { lt: new Date(Date.now() - UNCONFIRMED_ACCOUNT_LIFETIME) } }
  })
}
