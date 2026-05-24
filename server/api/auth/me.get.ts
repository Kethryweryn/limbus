import { getAuthToken, isAdminMode, requireAuthUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
    const token = getAuthToken(event)

    if (!token) {
        return { authenticated: false }
    }

    try {
        const user = await requireAuthUser(event)
        return {
            authenticated: true,
            user,
            adminMode: isAdminMode(event, user)
        }
    } catch {
        return { authenticated: false }
    }
})
