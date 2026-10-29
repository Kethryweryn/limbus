import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { csvFilename, toCsv } from '~/server/utils/csv'
import { REGISTRATION_DISPLAY_STATUS_META, registrationDisplayStatus } from '~/utils/registrations'

// Export CSV des inscriptions d'une session (US-005) : nom, email, téléphone, statut.
// Jamais de données de santé ni de contact d'urgence : la fiche allergies a son propre circuit (US-008).
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const session = await requireSessionAccess(event, getRouterParam(event, 'id') || '')
  const { name } = await prisma.session.findUniqueOrThrow({ where: { id: session.id }, select: { name: true } })
  const registrations = await prisma.registration.findMany({
    where: { sessionId: session.id },
    orderBy: { participant: { name: 'asc' } },
    select: { status: true, responseDueAt: true, email: true, phone: true, participant: { select: { name: true } } }
  })

  const now = new Date()
  const csv = toCsv(
    ['Nom', 'Email', 'Téléphone', 'Statut'],
    registrations.map((registration) => [
      registration.participant.name,
      registration.email,
      registration.phone,
      REGISTRATION_DISPLAY_STATUS_META[registrationDisplayStatus(registration, now)]?.label ?? registration.status
    ])
  )

  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${csvFilename(`inscriptions-${name}`)}"`)
  setHeader(event, 'cache-control', 'private, no-store')
  setHeader(event, 'x-content-type-options', 'nosniff')
  return csv
})
