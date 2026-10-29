import { requireUser } from '~/server/utils/auth'
import { accessibleGameIds, requireParticipantAccess } from '~/server/utils/gameAccess'
import { exportParticipantData } from '~/server/utils/participantPrivacy'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  await requireParticipantAccess(event, id)

  const data = await exportParticipantData(id, await accessibleGameIds(event))
  setHeader(event, 'Content-Disposition', `attachment; filename="participant-${id}.json"`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return data
})
