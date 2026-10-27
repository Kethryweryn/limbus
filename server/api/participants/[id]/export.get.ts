import { requireOrganizer } from '~/server/utils/auth'
import { accessibleGameIds, requireParticipantAccess } from '~/server/utils/gameAccess'
import { exportParticipantData } from '~/server/utils/participantPrivacy'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireParticipantAccess(event, id)

  const data = await exportParticipantData(id, await accessibleGameIds(event))
  setHeader(event, 'Content-Disposition', `attachment; filename="participant-${id}.json"`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return data
})
