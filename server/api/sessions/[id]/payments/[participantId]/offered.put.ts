import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readZodBody, sessionPaymentOfferedSchema } from '~/server/utils/schemas'
import { setSessionPaymentOffered } from '~/server/utils/sessionPayments'

// Place offerte (US-041)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  const body = await readZodBody(event, sessionPaymentOfferedSchema)
  return await setSessionPaymentOffered(session.id, requireRouterParam(event, 'participantId'), body.offered)
})
