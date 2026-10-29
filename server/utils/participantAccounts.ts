import { prisma } from '~/server/utils/prisma'
import { REGISTRATION_STATUSES } from '~/utils/domain'
import { splitParticipantName } from '~/utils/registrations'

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
  // Une fiche qui vient d'être rattachée reçoit les coordonnées du compte (US-074)
  await syncProfileToParticipants(user.id)
}

/**
 * Coordonnées du compte recopiées sur ses fiches et ses inscriptions non désistées (US-074, ADR-0042) :
 * chaque équipe lit la version à jour pour ses jeux. Rien tant que la personne ne les a jamais enregistrées.
 */
export async function syncProfileToParticipants(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, phone: true, emergencyContactName: true, emergencyContactPhone: true, dietary: true, healthConsentAt: true, profileUpdatedAt: true }
  })
  if (!user?.profileUpdatedAt) return
  const { firstName, lastName } = splitParticipantName(user.name)
  await prisma.$transaction([
    prisma.participant.updateMany({ where: { userId }, data: { name: user.name, phone: user.phone } }),
    prisma.registration.updateMany({
      where: { participant: { userId }, status: { not: REGISTRATION_STATUSES.withdrawn } },
      data: {
        firstName,
        lastName: lastName || null,
        phone: user.phone,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
        dietary: user.dietary,
        healthConsentAt: user.dietary ? user.healthConsentAt : null
      }
    })
  ])
}

// Identifiants des fiches rattachées au compte : le point de départ de toute route de l'espace participant
export async function myParticipantIds(userId: string) {
  return (await prisma.participant.findMany({ where: { userId }, select: { id: true } })).map((participant) => participant.id)
}
