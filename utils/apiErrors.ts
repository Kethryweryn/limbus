// Message lisible d'une erreur d'API : le détail d'une validation zod (rangé par h3 sous data.data)
// plutôt que « Invalid request body », sinon le message du serveur, sinon le texte par défaut.
export function apiErrorMessage(err: unknown, fallback: string) {
  const error = err as { data?: { message?: string, data?: { data?: Array<{ message?: string }> } }, message?: string } | null
  const issues = error?.data?.data?.data
  if (Array.isArray(issues) && issues.length) {
    return [...new Set(issues.map((issue) => issue.message).filter(Boolean))].join(' ; ')
  }
  return error?.data?.message || error?.message || fallback
}

// Détail par champ d'une validation zod, pour afficher chaque message sous son champ
export function apiFieldErrors(err: unknown): Record<string, string> {
  const issues = (err as { data?: { data?: { data?: Array<{ path?: string, message?: string }> } } } | null)?.data?.data?.data
  if (!Array.isArray(issues)) return {}
  return Object.fromEntries(issues.filter((issue) => issue.path).map((issue) => [issue.path!, issue.message || '']))
}
