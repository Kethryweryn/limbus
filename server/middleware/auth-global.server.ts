import { parse } from 'cookie'
import jwt from 'jsonwebtoken'

const SECRET = 'limbus-super-secret'

export default defineEventHandler((event) => {
  const url = event.node.req.url || ''

  // 🔁 Si déjà connecté → rediriger vers /dashboard si on demande /login
  if (url.startsWith('/login')) {
    const rawCookie = event.node.req.headers.cookie || ''
    const token = parse(rawCookie).limbus_token

    if (token) {
      try {
        jwt.verify(token, SECRET)
        // Token OK → on redirige vers /dashboard
        event.node.res.statusCode = 302
        event.node.res.setHeader('Location', '/dashboard')
        event.node.res.end()
        return
      } catch {
        // Token invalide → continuer vers /login
      }
    }

    return // pas de token → continuer
  }

  // ❌ Bloquer toutes les autres pages (sauf API) si non authentifié
  if (url.startsWith('/api')) return

  const rawCookie = event.node.req.headers.cookie || ''
  const token = parse(rawCookie).limbus_token

  if (!token) {
    event.node.res.statusCode = 302
    event.node.res.setHeader('Location', '/login')
    event.node.res.end()
    return
  }

  try {
    const payload = jwt.verify(token, SECRET)
    event.context.authUser = payload
  } catch {
    event.node.res.statusCode = 302
    event.node.res.setHeader('Location', '/login')
    event.node.res.end()
  }
})
