import jwt from 'jsonwebtoken'
import { getCookie } from 'h3'

const SECRET = 'limbus-super-secret'

export default defineEventHandler((event) => {
    const token = getCookie(event, 'limbus_token')

    if (!token) {
        return { authenticated: false }
    }

    try {
        const user = jwt.verify(token, SECRET)
        return { authenticated: true, user }
    } catch {
        return { authenticated: false }
    }
})
