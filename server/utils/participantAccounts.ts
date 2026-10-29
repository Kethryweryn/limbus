import { prisma } from '~/server/utils/prisma'
import { REGISTRATION_STATUSES } from '~/utils/domain'
import { splitParticipantName } from '~/utils/registrations'
import { normalizeRegistrationFormDefinition, type RegistrationFormDefinition } from '~/utils/registrationForms'

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
  // Inscriptions déjà remplies : seulement les champs que leur formulaire a demandés (on ne stocke que ce qui
  // a été demandé, R8). Une invitation sans réponse se préremplit à l'affichage
  const registrations = await prisma.registration.findMany({
    where: { participant: { userId }, status: { not: REGISTRATION_STATUSES.withdrawn }, formVersionId: { not: null } },
    select: { id: true, formVersion: { select: { definition: true } } }
  })
  await prisma.$transaction([
    prisma.participant.updateMany({ where: { userId }, data: { name: user.name, phone: user.phone } }),
    ...registrations.map((registration) => {
      const asked = normalizeRegistrationFormDefinition(registration.formVersion!.definition as RegistrationFormDefinition).standardFields
      return prisma.registration.update({
        where: { id: registration.id },
        data: {
          ...(asked.firstName.asked ? { firstName } : {}),
          ...(asked.lastName.asked ? { lastName: lastName || null } : {}),
          ...(asked.phone.asked ? { phone: user.phone } : {}),
          ...(asked.emergencyContact.asked ? { emergencyContactName: user.emergencyContactName, emergencyContactPhone: user.emergencyContactPhone } : {}),
          ...(asked.dietary.asked ? { dietary: user.dietary, healthConsentAt: user.dietary ? user.healthConsentAt : null } : {})
        }
      })
    })
  ])
}

// Identifiants des fiches rattachées au compte : le point de départ de toute route de l'espace participant
export async function myParticipantIds(userId: string) {
  return (await prisma.participant.findMany({ where: { userId }, select: { id: true } })).map((participant) => participant.id)
}
