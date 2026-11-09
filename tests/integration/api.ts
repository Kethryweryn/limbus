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
export async function api(user: TestUser | null, method: string, path: string, body?: unknown, options: { adminMode?: boolean, headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...options.headers }
  if (user) headers.cookie = `__Host-limbus_token=${tokenFor(user)}${options.adminMode ? '; __Host-limbus_admin_mode=1' : ''}`
  if (body !== undefined) headers['content-type'] = 'application/json'

  const response = await fetch(`${inject('baseUrl')}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual'
  })
  return { status: response.status, body: parseBody(await response.text()) }
}

/** Corps d'une réponse, typé par sa route : `bodyOf<ApiResponse<'/api/games/:id'>>(response)`. */
export function bodyOf<T>(response: { body: unknown }) {
  return response.body as T
}

/** Forme d'une réponse à plusieurs formes qui porte ce champ (une inscription ouverte plutôt que retirée…). */
export type WithField<T, K extends PropertyKey> = Extract<T, Record<K, unknown>>

/** Message d'une réponse en erreur (createError). */
export function errorMessage(response: { body: unknown }) {
  return (response.body as { message: string }).message
}

/** Refus de la validation d'un corps (readZodBody), dans l'ordre des erreurs. */
const invalidIssues = (response: { body: unknown }) => (response.body as { data: { data: Array<{ path: string, message: string }> } }).data.data

/** Champs refusés par la validation d'un corps, dans l'ordre des erreurs. */
export const invalidPaths = (response: { body: unknown }) => invalidIssues(response).map((issue) => issue.path)

/** Messages des champs refusés, dans le même ordre. */
export const invalidMessages = (response: { body: unknown }) => invalidIssues(response).map((issue) => issue.message)

// Refus attendu : 403 (accès interdit) ou 404 (ressource introuvable pour cet utilisateur)
export const DENIED = [403, 404]
