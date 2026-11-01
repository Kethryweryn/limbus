import { requireUser } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'

// Refus de l'usage de sa photo (US-109) : posé dès qu'une fiche du compte l'a
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return { refused: await prisma.participant.count({ where: { userId: user.id, photoRefusedAt: { not: null } } }) > 0 }
})
