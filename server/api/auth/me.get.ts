import { getAuthToken, getAuthUser } from '~/server/utils/auth'

export default defineEventHandler((event) => {
    const token = getAuthToken(event)

    if (!token) {
        return { authenticated: false }
    }

    const user = getAuthUser(event)
    if (!user) {
        return { authenticated: false }
    }

    return { authenticated: true, user }
})
