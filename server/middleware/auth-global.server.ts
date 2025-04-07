import { parse } from 'cookie'
import jwt from 'jsonwebtoken'

const SECRET = 'limbus-super-secret'

export default defineEventHandler((event) => {
  const url = event.node.req.url || ''

  // Ignorer les appels API ou la page de login
  if (url.startsWith('/api') || url.startsWith('/login')) return

  const rawCookie = event.node.req.headers.cookie || ''
  const cookies = parse(rawCookie)
  const token = cookies.limbus_token

  if (!token) {
    event.node.res.statusCode = 302
    event.node.res.setHeader('Location', '/login')
    event.node.res.end()
    return
  }

  try {
    const payload = jwt.verify(token, SECRET)
    event.context.authUser = payload // facultatif
  } catch {
    event.node.res.statusCode = 302
    event.node.res.setHeader('Location', '/login')
    event.node.res.end()
  }
})
