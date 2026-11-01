import { databaseResponds, deployedVersionOnce } from '~/server/utils/health'

// Page de santé pour la surveillance (US-103, ADR-0052) : publique, sans autre donnée, jamais en cache
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  if (!await databaseResponds()) {
    setResponseStatus(event, 503)
    return { status: 'error' }
  }
  return { status: 'ok', version: deployedVersionOnce() }
})
