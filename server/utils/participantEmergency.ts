import type { Prisma } from '~/generated/prisma/client'
import { prisma } from '~/server/utils/prisma'

const emergencySelect = { emergencyContactName: true, emergencyContactPhone: true, dietary: true } as const satisfies Prisma.RegistrationSelect

/**
 * Contact d'urgence et allergies montrés sur la fiche (SPEC-007, R1b) : ceux de l'inscription la plus récente dans les
 * jeux de l'organisatrice ; sans inscription, ceux du compte, les allergies seulement avec l'accord santé (comme la
 * fiche allergies, US-074). Lus à la demande de la fiche seule : ni la liste, ni les assistants, ni le cache hors ligne.
 * Une fiche hors des jeux accessibles répond 404, comme `requireParticipantAccess`.
 */
export async function readParticipantEmergency(participantId: string, gameIds: string[] | null) {
  const inGames = gameIds === null ? {} : { gameId: { in: gameIds } }
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, ...(gameIds === null ? {} : { gameLinks: { some: inGames } }) },
    select: {
      // Une invitation sans réponse n'a encore rien de rempli
      registrations: {
        where: { respondedAt: { not: null }, ...(gameIds === null ? {} : { period: inGames }) },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { ...emergencySelect, period: { select: { game: { select: { title: true } } } } }
      },
      user: { select: { ...emergencySelect, healthConsentAt: true, profileUpdatedAt: true } }
    }
  })
  if (!participant) throw createError({ statusCode: 404, message: 'Participant introuvable' })

  const [registration] = participant.registrations
  if (registration) {
    const { period, ...fields } = registration
    return { source: 'registration' as const, gameTitle: period.game.title, ...fields }
  }
  const { user } = participant
  // Coordonnées jamais enregistrées dans le compte : rien à montrer
  if (user?.profileUpdatedAt) {
    return {
      source: 'account' as const,
      gameTitle: null,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      dietary: user.healthConsentAt ? user.dietary : null
    }
  }
  return { source: null, gameTitle: null, emergencyContactName: null, emergencyContactPhone: null, dietary: null }
}
