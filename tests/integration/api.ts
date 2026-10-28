import jwt from 'jsonwebtoken'
import { inject } from 'vitest'
import { JWT_SECRET } from './constants'

export type TestUser = { id: string }

export function tokenFor(user: TestUser) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' })
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// adminMode : cookie du mode administrateur, pris en compte pour un compte admin seulement
export async function api(user: TestUser | null, method: string, path: string, body?: unknown, options: { adminMode?: boolean } = {}) {
  const headers: Record<string, string> = {}
  if (user) headers.cookie = `limbus_token=${tokenFor(user)}${options.adminMode ? '; limbus_admin_mode=1' : ''}`
  if (body !== undefined) headers['content-type'] = 'application/json'

  const response = await fetch(`${inject('baseUrl')}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual'
  })
  return { status: response.status, body: parseBody(await response.text()) }
}

// Refus attendu : 403 (accès interdit) ou 404 (ressource introuvable pour cet utilisateur)
export const DENIED = [403, 404]
