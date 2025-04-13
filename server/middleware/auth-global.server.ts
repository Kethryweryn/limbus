import {
  isAuthenticated,
  redirect,
  getAuthUser,
  requireRole
} from '../utils/auth'

export default defineEventHandler((event) => {
  const url = event.node.req.url || ''

  // Ignorer uniquement les API d'authentification
  if (url.startsWith('/api/auth')) return

  // Reload si non authentifié
  if (!isAuthenticated(event)) {
    return redirect(event, '/')
  }

  // Stocker l'utilisateur dans le contexte si on veut l'exploiter ailleurs
  const rawUser = getAuthUser(event)
  event.context.authUser = rawUser ? JSON.parse(JSON.stringify(rawUser)) : null

  // Exemple : restreindre les pages /admin à "orga"
  if (url.startsWith('/admin') || url.startsWith('/organizer')) {
    if (!requireRole(event, ['organizer'])) {
      return redirect(event, '/dashboard')
    }
  }
})
