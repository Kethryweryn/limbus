import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readZodBody, sessionTariffSchema } from '~/server/utils/schemas'
import { updateSessionTariff } from '~/server/utils/sessionPayments'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  const body = await readZodBody(event, sessionTariffSchema)
  await assertUnmodifiedSince(event, 'sessionTariff', requireRouterParam(event, 'tariffId'))
  return await updateSessionTariff(session.id, requireRouterParam(event, 'tariffId'), body)
})
