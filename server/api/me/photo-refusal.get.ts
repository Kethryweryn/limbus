import { requireUser } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'

// Refus de l'usage de sa photo (US-109) : posé dès qu'une fiche du compte l'a. Sans fiche, le réglage ne concerne pas le compte (US-177)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const participants = await prisma.participant.findMany({ where: { userId: user.id }, select: { photoRefusedAt: true } })
  return { concerned: participants.length > 0, refused: participants.some((participant) => participant.photoRefusedAt) }
})
