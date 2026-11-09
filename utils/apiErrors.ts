import { isOfflineMissing } from './connection'
// Message lisible d'une erreur d'API : le détail d'une validation zod (rangé par h3 sous data.data)
// plutôt que « Requête invalide », sinon le message du serveur, sinon le texte par défaut.
export function apiErrorMessage(err: unknown, fallback: string) {
  const error = err as { data?: { message?: string, data?: { data?: Array<{ message?: string }> } }, message?: string } | null
  const issues = error?.data?.data?.data
  if (Array.isArray(issues) && issues.length) {
    return [...new Set(issues.map((issue) => issue.message).filter(Boolean))].join(' ; ')
  }
  return serverMessage(err, error?.message || fallback)
}

// Détail par champ d'une validation zod, pour afficher chaque message sous son champ
export function apiFieldErrors(err: unknown): Record<string, string> {
  const issues = (err as { data?: { data?: { data?: Array<{ path?: string, message?: string }> } } } | null)?.data?.data?.data
  if (!Array.isArray(issues)) return {}
  return Object.fromEntries(issues.filter((issue) => issue.path).map((issue) => [issue.path!, issue.message || '']))
}

// Message du serveur seul (h3 le range sous data.message), sinon le texte par défaut ; apiErrorMessage y ajoute le
// détail d'une validation et le message technique
export function serverMessage(err: unknown, fallback: string) {
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
