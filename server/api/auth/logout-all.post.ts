import { clearAuthCookie, requireAuthUser, revokeUserSessions } from '~/server/utils/auth'

// Déconnexion de tous les appareils (session oubliée sur un poste partagé, téléphone perdu…)
export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event, { allowUnconfirmed: true })
  await revokeUserSessions(user.id)
  clearAuthCookie(event)
  return { success: true }
})
