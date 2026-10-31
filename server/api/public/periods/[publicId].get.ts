import { exposeFormPeriod, optionalAccount, requireFormPeriod } from '~/server/utils/formRegistrations'
import { assertRateLimit } from '~/server/utils/rateLimit'

// Lien de diffusion d'une période en mode formulaire (US-084, R32) : public, même sans page publique du jeu
export default defineEventHandler(async (event) => {
  assertRateLimit(event, { name: 'public-form-read', limit: 300, windowMs: 10 * 60 * 1000 })
  // Préremplie pour une personne connectée : la réponse ne se met pas en cache
  setHeader(event, 'Cache-Control', 'private, no-store')
  const period = await requireFormPeriod(getRouterParam(event, 'publicId'))
  return await exposeFormPeriod(period, await optionalAccount(event))
})
