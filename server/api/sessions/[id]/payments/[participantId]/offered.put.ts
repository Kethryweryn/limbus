import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertPaymentUnmodifiedSince } from '~/server/utils/concurrency'
import { readZodBody, sessionPaymentOfferedSchema } from '~/server/utils/schemas'
import { setSessionPaymentOffered } from '~/server/utils/sessionPayments'

// Place offerte (US-041)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  const body = await readZodBody(event, sessionPaymentOfferedSchema)
  await assertPaymentUnmodifiedSince(event, session.id, requireRouterParam(event, 'participantId'))
  return await setSessionPaymentOffered(session.id, requireRouterParam(event, 'participantId'), body.offered)
})
