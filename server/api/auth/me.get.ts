import { getAuthToken, isAdminMode, requireAuthUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
    const token = getAuthToken(event)

    if (!token) {
        return { authenticated: false }
    }

    try {
        // Un compte non confirmé est connecté : l'application lui montre l'écran de confirmation (R5)
        const user = await requireAuthUser(event, { allowUnconfirmed: true })
        return {
            authenticated: true,
            user,
            adminMode: isAdminMode(event, user)
        }
    } catch {
        return { authenticated: false }
    }
})
