import { getRouterParam } from 'h3'
import type { H3Event } from 'h3'

const MISSING_MESSAGES: Record<string, string> = {
  id: 'ID manquant',
  slug: 'Slug manquant',
  token: 'Token manquant'
}

// Paramètre d'URL obligatoire (/api/games/:id…) : 400 s'il manque, sinon sa valeur
export function requireRouterParam(event: H3Event, name: string) {
  const value = getRouterParam(event, name)
  if (!value) {
    throw createError({ statusCode: 400, message: MISSING_MESSAGES[name] || 'Paramètre manquant' })
  }
  return value
}
