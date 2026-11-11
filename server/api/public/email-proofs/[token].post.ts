import { confirmEmailProof } from '~/server/utils/emailProofs'
import { assertRateLimit } from '~/server/utils/rateLimit'

// Preuve d'une adresse donnée en réponse (US-243, ADR-0087) : appelée par le bouton de la page du lien, jamais au
// simple affichage, pour qu'un logiciel qui ouvre les liens d'un email ne prouve rien. Rien de l'autre fiche n'est rendu
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const windowMs = 15 * 60 * 1000
  assertRateLimit(event, { name: 'email-proof', limit: 10, windowMs, keyParts: [token ?? ''] })
  assertRateLimit(event, { name: 'email-proof-ip', limit: 60, windowMs })
  const { email } = await confirmEmailProof(token)
  return { email }
})
