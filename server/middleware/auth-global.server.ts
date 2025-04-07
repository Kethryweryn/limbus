import {
  isAuthenticated,
  redirect,
  getAuthUser,
  isApiRoute,
  isLoginPage
} from '../utils/auth'

export default defineEventHandler((event) => {
  const url = event.node.req.url || ''

  // Rediriger les utilisateurs déjà connectés loin de /login
  if (isLoginPage(url) && isAuthenticated(event)) {
    return redirect(event, '/dashboard')
  }

  // Ignorer les appels API
  if (isApiRoute(url)) return

  // Rediriger si non authentifié
  if (!isAuthenticated(event)) {
    return redirect(event, '/login')
  }

  // Stocker l'utilisateur dans le contexte si on veut l'exploiter ailleurs
  event.context.authUser = getAuthUser(event)

  // Exemple : restreindre les pages /admin à "orga"
  if (url.startsWith('/admin') || url.startsWith('/orga')) {
    if (!requireRole(event, ['orga'])) {
      return redirect(event, '/dashboard')
    }
  }
})
