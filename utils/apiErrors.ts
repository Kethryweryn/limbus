import { getErrorStatus, isOfflineMissing } from './connection'

// Action ou page qui ne peut pas aboutir faute de réseau (US-214)
export const NO_NETWORK_MESSAGE = 'Pas de réseau : cette action demande une connexion. Réessayez quand le réseau revient.'
export const NO_NETWORK_PAGE_MESSAGE = 'Pas de réseau : cette page demande une connexion. Réessayez quand le réseau revient.'

type ApiFailure = { name?: string, message?: string, data?: { message?: string, data?: { data?: Array<{ message?: string }> } } } | null

// Appel ($fetch) resté sans réponse : le réseau manque. Une autre erreur (TypeError d'un bug de la page…) n'est
// pas prise pour une coupure
function isUnanswered(err: unknown) {
  return (err as ApiFailure)?.name === 'FetchError' && !getErrorStatus(err)
}

// Message lisible d'une erreur d'API : le réseau qui manque, le détail d'une validation zod (rangé par h3 sous
// data.data) plutôt que « Requête invalide », sinon le message du serveur, sinon celui d'une erreur levée par
// Limbus lui-même (`new Error`, action refusée hors ligne…), sinon le texte par défaut. Le texte technique de
// $fetch (« [POST] "/api/…": 500 ») ou d'une TypeError ne s'affiche jamais.
export function apiErrorMessage(err: unknown, fallback: string) {
  if (isUnanswered(err)) return NO_NETWORK_MESSAGE
  const error = err as ApiFailure
  const issues = error?.data?.data?.data
  if (Array.isArray(issues) && issues.length) {
    return [...new Set(issues.map((issue) => issue.message).filter(Boolean))].join(' ; ')
  }
  return serverMessage(err, (error?.name === 'Error' && error.message) || fallback)
}

// Chargement d'une page : comme apiErrorMessage, mais le réseau qui manque empêche la page, et non une action
export function loadErrorMessage(err: unknown, fallback: string) {
  return isUnanswered(err) ? NO_NETWORK_PAGE_MESSAGE : apiErrorMessage(err, fallback)
}

// Détail par champ d'une validation zod, pour afficher chaque message sous son champ
export function apiFieldErrors(err: unknown): Record<string, string> {
  const issues = (err as { data?: { data?: { data?: Array<{ path?: string, message?: string }> } } } | null)?.data?.data?.data
  if (!Array.isArray(issues)) return {}
  return Object.fromEntries(issues.filter((issue) => issue.path).map((issue) => [issue.path!, issue.message || '']))
}

// Message du serveur seul (h3 le range sous data.message), sinon le texte par défaut ; les écrans passent par
// apiErrorMessage ou loadErrorMessage, qui y ajoutent le réseau absent et le détail d'une validation
function serverMessage(err: unknown, fallback: string) {
  return (err as { data?: { message?: string } } | null)?.data?.message || fallback
}

/**
 * Erreur de chargement d'une page, à lever : `fatal` ouvre `error.vue`, aussi dans le navigateur.
 * Une panne garde son code (Nuxt donne 500 à un réseau coupé) : ce n'est pas une page absente.
 * Une fiche jamais lue sur l'appareil, hors ligne, le dit : `error.vue` affiche ce message.
 */
export function pageLoadError(error: { statusCode?: number } | null | undefined, message: string) {
  if (isOfflineMissing(error)) {
    return createError({ fatal: true, statusCode: 503, message: 'Cette fiche n’a pas été consultée avec le réseau sur cet appareil : elle n’est pas disponible hors ligne.' })
  }
  return createError({ fatal: true, statusCode: error?.statusCode ?? 500, message })
}
