import { parseCspReport, recordCspViolation } from '~/server/utils/cspReports'
import { assertRateLimit } from '~/server/utils/rateLimit'

// Rapports de la CSP en mode rapport (US-106, ADR-0053) : publique, envoyée par le navigateur lui-même, sans réponse
export default defineEventHandler(async (event) => {
  assertRateLimit(event, { name: 'csp-report', limit: 100, windowMs: 10 * 60 * 1000 })
  const violation = parseCspReport(await readRawBody(event, 'utf8'))
  if (violation) await recordCspViolation(violation)
  setResponseStatus(event, 204)
  return null
})
