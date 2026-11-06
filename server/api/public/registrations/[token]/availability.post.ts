import { answerSessionAvailability, exposePublicRegistration, guardPublicRegistrationRequest, requireRegistrationByToken } from '~/server/utils/publicRegistrations'
import { readZodBody, registrationAvailabilityAnswerSchema } from '~/server/utils/schemas'

// Réponse à une demande de disponibilités (R11, R29) : ouvrir le lien de l'email n'écrit rien, seule cette route le fait
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')

  const token = getRouterParam(event, 'token')
  const registration = await requireRegistrationByToken(token)
  const { sessionId, available } = await readZodBody(event, registrationAvailabilityAnswerSchema)
  const availabilityEffect = await answerSessionAvailability(registration, sessionId, available)
  return { ...(await exposePublicRegistration(await requireRegistrationByToken(token))), availabilityEffect }
})
