import { sessionLabelsFor } from '~/server/utils/sessionLabels'
import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { csvFilename, toCsv } from '~/server/utils/csv'
import { REGISTRATION_DISPLAY_STATUS_META, registrationDisplayStatus } from '~/utils/registrations'
import { byName, withGameValues } from '~/server/utils/participantValues'

// Export CSV des personnes d'une session (US-005) : nom, email, téléphone, statut.
// Jamais de données de santé ni de contact d'urgence : la fiche allergies a son propre circuit (US-008).
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const session = await requireSessionAccess(event, getRouterParam(event, 'id') || '')
  const label = (await sessionLabelsFor(prisma, [session.id])).get(session.id) ?? 'session'
  // Nom tenu par l'équipe du jeu, trié à l'export (ADR-0086)
  const lines = (await withGameValues(await prisma.registrationSession.findMany({
    where: { sessionId: session.id },
    select: { status: true, responseDueAt: true, registration: { select: { gameId: true, email: true, phone: true, participant: { select: { id: true, name: true } } } } }
  }))).sort((left, right) => byName(left.registration.participant, right.registration.participant))

  const now = new Date()
  const csv = toCsv(
    ['Nom', 'Email', 'Téléphone', 'Statut'],
    lines.map((line) => [
      line.registration.participant.name,
      line.registration.email,
      line.registration.phone,
      REGISTRATION_DISPLAY_STATUS_META[registrationDisplayStatus(line, now)]?.label ?? line.status
    ])
  )

  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${csvFilename(`inscriptions-${label}`)}"`)
  setHeader(event, 'cache-control', 'private, no-store')
  setHeader(event, 'x-content-type-options', 'nosniff')
  return csv
})
