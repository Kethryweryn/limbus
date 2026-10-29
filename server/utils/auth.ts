import jwt from 'jsonwebtoken'
import { deleteCookie, getCookie, setCookie } from 'h3'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { USER_ROLES } from '~/utils/domain'

export type AuthUser = {
  id: string
  email: string
  name?: string
  role: string
  // Adresse confirmée (ADR-0039) : sinon le compte ne fait que renvoyer le lien
  emailConfirmed: boolean
}

const AUTH_COOKIE = 'limbus_token'
const SESSION_DURATION_SECONDS = 60 * 60 * 20

function getJwtSecret(): string {
  const secret = useRuntimeConfig().jwtSecret || process.env.JWT_SECRET
  if (!secret) {
    throw createError({ statusCode: 500, message: 'JWT secret is not configured' })
  }
  return secret
}

export function getAuthToken(event: H3Event): string | undefined {
  return getCookie(event, AUTH_COOKIE)
}

declare module 'h3' {
  interface H3EventContext {
    authUser?: AuthUser
  }
}

type AuthTokenPayload = jwt.JwtPayload & { id?: unknown, v?: unknown }

export function getAuthUser(event: H3Event): AuthTokenPayload | null {
  const token = getAuthToken(event)
  if (!token) return null

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] })
    return typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

// allowUnconfirmed : routes ouvertes à un compte dont l'adresse n'est pas confirmée (me, renvoi du lien)
export async function requireAuthUser(event: H3Event, options: { allowUnconfirmed?: boolean } = {}): Promise<AuthUser> {
  const user = event.context.authUser ?? await loadAuthUser(event)
  if (!user.emailConfirmed && !options.allowUnconfirmed) {
    throw createError({ statusCode: 403, message: 'Confirmez d’abord votre adresse email.', data: { unconfirmed: true } })
  }
  return user
}

async function loadAuthUser(event: H3Event): Promise<AuthUser> {
  // Le jeton n'est qu'une référence : rôle et email sont relus en base à chaque requête
  const payload = getAuthUser(event)
  const id = payload?.id
  if (typeof id !== 'string' || !id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const record = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      sessionVersion: true,
      emailConfirmedAt: true,
      disabledAt: true
    }
  })

  // Un jeton émis avant la dernière révocation n'est plus valable (jeton sans version : 0) ; un compte désactivé non plus
  const tokenVersion = payload?.v ?? 0
  if (!record || tokenVersion !== record.sessionVersion || record.disabledAt) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const { sessionVersion: _sessionVersion, emailConfirmedAt, disabledAt: _disabledAt, ...fields } = record
  const user = { ...fields, emailConfirmed: Boolean(emailConfirmedAt) }
  event.context.authUser = user
  return user
}

export function signAuthToken(payload: string | object | Buffer): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: SESSION_DURATION_SECONDS })
}

export function setAuthCookie(event: H3Event, user: { id: string, sessionVersion: number }) {
  setCookie(event, AUTH_COOKIE, signAuthToken({ id: user.id, v: user.sessionVersion }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: SESSION_DURATION_SECONDS
  })
}

export function clearAuthCookie(event: H3Event) {
  deleteCookie(event, AUTH_COOKIE, { path: '/' })
}

// Déconnecte l'utilisateur sur tous ses appareils : les jetons déjà émis ne passent plus
export async function revokeUserSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } }
  })
}

export function redirect(event: H3Event, location: string) {
  event.node.res.statusCode = 302
  event.node.res.setHeader('Location', location)
  event.node.res.end()
}

export async function requireRole(event: H3Event, allowedRoles: string[]): Promise<boolean> {
  const user = await requireAuthUser(event)
  return allowedRoles.includes(user.role)
}

// Un compte connecté, quel que soit son rôle : les droits sur un jeu viennent de sa propriété ou de son partage
// (ADR-0038), vérifiés ensuite route par route
export async function requireUser(event: H3Event): Promise<AuthUser> {
  return await requireAuthUser(event)
}

export async function requireAdmin(event: H3Event): Promise<AuthUser> {
  const user = await requireAuthUser(event)
  if (user.role !== USER_ROLES.admin) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return user
}

export function isAdminMode(event: H3Event, user: Pick<AuthUser, 'role'>): boolean {
  return user.role === USER_ROLES.admin && getCookie(event, 'limbus_admin_mode') === '1'
}
