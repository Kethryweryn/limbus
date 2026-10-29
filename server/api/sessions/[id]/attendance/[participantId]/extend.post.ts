import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { extendAttendance } from '~/server/utils/attendance'
import { assertNewResponseDueAt } from '~/server/utils/registrations'
import { readZodBody, registrationExtensionSchema } from '~/server/utils/schemas'

// Nouvelle date limite de confirmation de présence (US-024)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const participantId = requireRouterParam(event, 'participantId')
  const session = await requireSessionAccess(event, id)
  const { responseDueAt } = await readZodBody(event, registrationExtensionSchema)
  assertNewResponseDueAt(responseDueAt)
  return await extendAttendance(session.id, participantId, responseDueAt)
})
