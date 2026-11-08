import { useApiFetch } from '~/composables/useApiFetch'

/**
 * Confirmation puis suppression d'un élément d'écriture, commune aux listes et aux fiches (US-186). Rend false si la
 * personne refuse ; une erreur du serveur remonte à l'appelant. Hors ligne, la suppression part en file (ADR-0036).
 */
export async function confirmedDelete(url: string, confirmText: string) {
  if (!confirm(confirmText)) return false
  await useApiFetch(url, { method: 'DELETE' })
  return true
}
