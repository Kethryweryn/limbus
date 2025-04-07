// server/api/auth/me.get.ts
import jwt from 'jsonwebtoken'
import { parse } from 'cookie'

const SECRET = 'limbus-super-secret'

export default defineEventHandler(async (event) => {
    const rawCookie = event.node?.req?.headers?.cookie || ''
    console.log('[auth/me] raw cookie string (node):', rawCookie)

    const cookies = parse(rawCookie)
    console.log('[auth/me] parsed cookies:', cookies)

    const token = cookies.limbus_token
    console.log('[auth/me] token:', token)

    if (!token) {
        return { authenticated: false }
    }

    try {
        const payload = jwt.verify(token, SECRET)
        return { authenticated: true, user: payload }
    } catch (e) {
        return { authenticated: false }
    }
})
