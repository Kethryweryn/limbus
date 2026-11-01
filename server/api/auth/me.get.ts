import { TERMS_VERSION } from '~/utils/legal'
import { prisma } from '~/server/utils/prisma'
import { getAuthToken, isAdminMode, requireAuthUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
    const token = getAuthToken(event)

    if (!token) {
        return { authenticated: false }
    }

    try {
        // Un compte non confirmé est connecté : l'application lui montre l'écran de confirmation (R5)
        const user = await requireAuthUser(event, { allowUnconfirmed: true })
        // Espaces du sélecteur (US-073) : un jeu possédé ou partagé, une fiche participant rattachée
        const [organize, participate] = user.emailConfirmed
            ? await Promise.all([
                prisma.game.count({ where: { OR: [{ ownerId: user.id }, { shares: { some: { userId: user.id } } }] } }),
                prisma.participant.count({ where: { userId: user.id } })
            ])
            : [0, 0]
        // Conditions d'utilisation en vigueur acceptées (US-111) : sinon l'application les demande
        const { termsAcceptedVersion } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { termsAcceptedVersion: true } })
        return {
            authenticated: true,
            user,
            termsAccepted: termsAcceptedVersion === TERMS_VERSION,
            adminMode: isAdminMode(event, user),
            spaces: { organize: organize > 0, participate: participate > 0 }
        }
    } catch {
        return { authenticated: false }
    }
})
