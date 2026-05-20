import jwt from 'jsonwebtoken'
import { getCookie } from 'h3'
import type { H3Event } from 'h3'

function getJwtSecret(): string {
  const secret = useRuntimeConfig().jwtSecret
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'JWT secret is not configured' })
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
  if (!requireRole(event, ['organizer'])) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
}
