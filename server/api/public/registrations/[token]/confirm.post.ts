import { confirmRegistrationRequest } from '~/server/utils/formRegistrations'
import { exposePublicRegistration, guardPublicRegistrationRequest, INVALID_LINK_MESSAGE, requireRegistrationByToken } from '~/server/utils/publicRegistrations'

// Confirmation de l'email d'une inscription par le formulaire (US-085) : appelée par la page du lien, jamais au
// simple affichage, pour qu'un logiciel qui ouvre les liens d'un email ne confirme rien (ADR-0046)
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')
  const token = getRouterParam(event, 'token')
  if (!await confirmRegistrationRequest(token)) {
    throw createError({ statusCode: 404, message: INVALID_LINK_MESSAGE })
  }
  return await exposePublicRegistration(await requireRegistrationByToken(token))
})
