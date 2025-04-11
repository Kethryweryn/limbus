import {
  isAuthenticated,
  redirect,
  getAuthUser,
  isApiRoute,
  isLoginPage
} from '../utils/auth'

export default defineEventHandler((event) => {
  const url = event.node.req.url || ''

  // Ignorer uniquement les API d'authentification
  if (url.startsWith('/api/auth')) return

  // Rediriger les utilisateurs déjà connectés loin de /login
  if (isLoginPage(url)) {
    if (isAuthenticated(event)) {
      return redirect(event, '/dashboard')
    }
    return
  }

  // Rediriger si non authentifié
  if (!isAuthenticated(event)) {
    return redirect(event, '/login')
  }

  // Stocker l'utilisateur dans le contexte si on veut l'exploiter ailleurs
  event.context.authUser = getAuthUser(event)

  // Exemple : restreindre les pages /admin à "orga"
  if (url.startsWith('/admin') || url.startsWith('/organizer')) {
    if (!requireRole(event, ['organizer'])) {
      return redirect(event, '/dashboard')
    }
  }
})
