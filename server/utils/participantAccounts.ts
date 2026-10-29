import { prisma } from '~/server/utils/prisma'

// Rattachement des fiches participant au compte de leur adresse confirmée (US-070, ADR-0041)

// Compte confirmé d'une adresse, auquel une fiche à cette adresse se rattache ; null sinon
export async function accountIdForEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase()
  if (!normalized) return null
  const user = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true, emailConfirmedAt: true } })
  return user?.emailConfirmedAt ? user.id : null
}

// À la confirmation d'une adresse : toutes les fiches qui la portent, sans tenir compte de la casse
export async function linkParticipantsToUser(user: { id: string, email: string }) {
  await prisma.participant.updateMany({
    where: { email: { equals: user.email.trim(), mode: 'insensitive' } },
    data: { userId: user.id }
  })
}

// Identifiants des fiches rattachées au compte : le point de départ de toute route de l'espace participant
export async function myParticipantIds(userId: string) {
  return (await prisma.participant.findMany({ where: { userId }, select: { id: true } })).map((participant) => participant.id)
}
