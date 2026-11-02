import type { H3Event } from 'h3'

// Réponses des points d'accès OAuth (US-121) : erreurs au format OAuth (RFC 6749, 5.2), jamais en cache

export function oauthError(event: H3Event, status: number, error: string, description?: string) {
  setResponseStatus(event, status)
  setResponseHeader(event, 'cache-control', 'no-store')
  return description ? { error, error_description: description } : { error }
}

export async function readOAuthJson(event: H3Event): Promise<Record<string, unknown>> {
  try {
    const body = JSON.parse(await readRawBody(event) || '{}')
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  } catch {
    return {}
  }
}

/** Corps d'un point d'accès `token` : `application/x-www-form-urlencoded` (RFC 6749, 4.1.3). */
export async function readOAuthForm(event: H3Event): Promise<Record<string, string>> {
  return Object.fromEntries(new URLSearchParams(await readRawBody(event) || ''))
}

/** Retour vers l'assistant, avec `iss` (RFC 9207) et `state`. */
export function authorizationRedirect(redirectUri: string, params: Record<string, string | null | undefined>) {
  const url = new URL(redirectUri)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  return url.href
}
