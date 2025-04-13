import {
  redirect,
  requireRole
} from '../utils/auth'

export default defineEventHandler((event) => {
  const url = event.node.req.url || ''

  // Ignorer uniquement les API d'authentification
  if (url.startsWith('/api/auth')) return

  // Exemple : restreindre les pages /admin à "orga"
  if (url.startsWith('/admin') || url.startsWith('/organizer')) {
    if (!requireRole(event, ['organizer'])) {
      return redirect(event, '/')
    }
  }
})
