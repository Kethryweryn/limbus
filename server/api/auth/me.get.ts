//import jwt from 'jsonwebtoken'
import { parse } from 'cookie'

const SECRET = 'limbus-super-secret'

export default defineEventHandler((event) => {
    const token = parse(event.node?.req?.headers?.cookie || '').limbus_token

    if (!token) {
        return { authenticated: false }
    }

    try {
        //const user = jwt.verify(token, SECRET)
        return { authenticated: true }
    } catch {
        return { authenticated: false }
    }
})
