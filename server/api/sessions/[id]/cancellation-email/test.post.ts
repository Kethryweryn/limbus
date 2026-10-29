import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'
import { cancellationEmailTestSchema, readZodBody } from '~/server/utils/schemas'
import { sendCancellationTestEmail } from '~/server/utils/sessionLifecycle'

// Test de l'email d'annulation, aux adresses choisies (US-025)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)
  assertRateLimit(event, {
    name: 'session-cancellation-test-email',
    limit: 20,
    windowMs: 15 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })

  const body = await readZodBody(event, cancellationEmailTestSchema)
  return await sendCancellationTestEmail(session.id, body)
})
