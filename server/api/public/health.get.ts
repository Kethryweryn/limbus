import { databaseResponds, deployedVersionOnce } from '~/server/utils/health'
import { assertRateLimit } from '~/server/utils/rateLimit'

// Page de santé pour la surveillance (US-103, ADR-0052) : publique, sans autre donnée, jamais en cache.
// Limite large par adresse : une sonde passe toutes les quelques minutes, un abus ne monopolise pas la base
export default defineEventHandler(async (event) => {
  assertRateLimit(event, { name: 'health', limit: 60, windowMs: 60 * 1000 })
  setHeader(event, 'Cache-Control', 'no-store')
  if (!await databaseResponds()) {
    setResponseStatus(event, 503)
    return { status: 'error' }
  }
  return { status: 'ok', version: deployedVersionOnce() }
})
