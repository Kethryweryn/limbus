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

export function getAuthUser(event: H3Event): any | null {
  const token = getAuthToken(event)
  if (!token) return null

  try {
    return jwt.verify(token, getJwtSecret())
  } catch {
    return null
  }
}

export async function requireAuthUser(event: H3Event): Promise<AuthUser> {
  const payload = getAuthUser(event)
  if (!payload || typeof payload !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = 'id' in payload ? String((payload as any).id || '') : ''
  const email = 'email' in payload ? String((payload as any).email || '') : ''
  if (!id && !email) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const user = await prisma.user.findFirst({
    where: id ? { id } : { email },
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

export function requireRole(event: H3Event, allowedRoles: string[]): boolean {
  const user = getAuthUser(event)
  if (!user || typeof user !== 'object' || !('role' in user)) return false

  return allowedRoles.includes((user as any).role)
}

export function requireOrganizer(event: H3Event): void {
  if (!requireRole(event, [USER_ROLES.organizer, USER_ROLES.admin])) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
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
