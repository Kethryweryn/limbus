import jwt from 'jsonwebtoken'
import { parse } from 'cookie'
import { H3Event } from 'h3'

const SECRET = 'limbus-super-secret'

export function getAuthToken(event: H3Event): string | undefined {
  const rawCookie = event.node.req.headers.cookie || ''
  const cookies = parse(rawCookie)
  return cookies.limbus_token
}

export function getAuthUser(event: H3Event): any | null {
  const token = getAuthToken(event)
  if (!token) return null

  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}

export function isAuthenticated(event: H3Event): boolean {
  return !!getAuthUser(event)
}

export function redirect(event: H3Event, location: string) {
  event.node.res.statusCode = 302
  event.node.res.setHeader('Location', location)
  event.node.res.end()
}

export function isLoginPage(url: string): boolean {
  return url === '/login'
}

export function requireRole(event: H3Event, allowedRoles: string[]): boolean {
  const user = getAuthUser(event)
  if (!user || typeof user !== 'object' || !('role' in user)) return false

  return allowedRoles.includes((user as any).role)
}