import {
  isAuthenticated,
  redirect,
  getAuthUser,
  isApiRoute,
  isLoginPage
} from '../utils/auth'

export default defineEventHandler((event) => {
  console.log('🛡️ [middleware] Incoming URL:', event.node.req.url)

  const url = event.node.req.url || ''

  // Ignorer les appels API
  if (isApiRoute(url)) return

  // Rediriger les utilisateurs déjà connectés loin de /login
  if (isLoginPage(url)) {
    console.log('🛡️ [middleware] on /login — Authenticated?', isAuthenticated(event))
    if (isAuthenticated(event)) {
      console.log('🔁 Redirecting from /login to /dashboard')
      return redirect(event, '/dashboard')
    }
    return
  }

  // Rediriger si non authentifié
  if (!isAuthenticated(event)) {
    console.log('🔁 Redirecting to /login (pas auth)')
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
