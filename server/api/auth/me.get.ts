// server/api/auth/me.get.ts
import jwt from 'jsonwebtoken'
import { getHeader } from 'h3'
import { parse } from 'cookie'

const SECRET = 'limbus-super-secret'

export default defineEventHandler(async (event) => {
    console.log('[auth/me] HEADERS DEBUG:', event.req.headers)

    const rawCookie = getHeader(event, 'cookie') || ''
    console.log('[auth/me] raw cookie string:', rawCookie)

    const cookies = parse(rawCookie)
    console.log('[auth/me] parsed cookies:', cookies)

    const token = cookies.limbus_token
    console.log('[auth/me] token:', token)


    console.log('[auth/me] cookies:', cookies)
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
