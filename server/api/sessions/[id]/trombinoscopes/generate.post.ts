import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { generateSessionTrombinoscopes } from '~/server/utils/trombinoscopes'
import { publicAppUrl } from '~/server/utils/appUrl'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const session = await requireSessionAccess(event, id)

  return await generateSessionTrombinoscopes(session.id, publicAppUrl())
})
