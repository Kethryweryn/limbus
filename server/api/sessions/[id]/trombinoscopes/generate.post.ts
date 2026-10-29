import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { generateSessionTrombinoscopes } from '~/server/utils/trombinoscopes'
import { publicAppUrl } from '~/server/utils/appUrl'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)

  return await generateSessionTrombinoscopes(session.id, publicAppUrl())
})
