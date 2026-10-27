import jwt from 'jsonwebtoken'
import { getCookie } from 'h3'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { USER_ROLES } from '~/utils/domain'

export type AuthUser = {
  id: string
  email: string
  name?: string
  role: string
}

function getJwtSecret(): string {
  const secret = useRuntimeConfig().jwtSecret
  if (!secret) {
    throw createError({ statusCode: 500, message: 'JWT secret is not configured' })
  }
  return secret
}

export function getAuthToken(event: H3Event): string | undefined {
  return getCookie(event, 'limbus_token')
}

declare module 'h3' {
  interface H3EventContext {
    authUser?: AuthUser
  }
}

type AuthTokenPayload = jwt.JwtPayload & { id?: unknown }

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

export async function requireAuthUser(event: H3Event): Promise<AuthUser> {
  if (event.context.authUser) return event.context.authUser

  // Le jeton n'est qu'une référence : rôle et email sont relus en base à chaque requête
  const id = getAuthUser(event)?.id
  if (typeof id !== 'string' || !id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  })

  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  event.context.authUser = user
  return user
}

export function signAuthToken(payload: string | object | Buffer): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '20h' })
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

export async function requireOrganizer(event: H3Event): Promise<AuthUser> {
  const user = await requireAuthUser(event)
  if (!([USER_ROLES.organizer, USER_ROLES.admin] as string[]).includes(user.role)) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return user
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
