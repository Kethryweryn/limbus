import { readZodBody } from '~/server/utils/schemas'
import { registrationAnswerSchema } from '~/server/utils/registrationForms'
import {
  answerFormDefinition,
  exposePublicRegistration,
  frozenFormVersionId,
  guardPublicRegistrationRequest,
  readAvailability,
  requireRegistrationByToken,
  saveRegistrationAnswers,
  sendRegistrationConfirmationEmail
} from '~/server/utils/publicRegistrations'
import { registrationUrl } from '~/server/utils/registrations'

// Répondre à l'invitation, ou modifier ses réponses à tout moment (R14)
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')

  const token = getRouterParam(event, 'token')!
  const registration = await requireRegistrationByToken(token)
  const form = await answerFormDefinition(registration)
  const { charterAccepted: _charterAccepted, healthConsent: _healthConsent, ...answers } = await readZodBody(event, registrationAnswerSchema(form.definition))

  const availableSessionIds = await readAvailability(event, registration)

  const versionId = await frozenFormVersionId(registration, form.versionId)
  const { accepted, keptSessions, addressProofSent } = await saveRegistrationAnswers(registration, versionId, { ...answers, availableSessionIds }, form.definition)
  // Adresse à prouver (US-243) : la confirmation, avec le lien personnel, part à l'adresse gardée, jamais à l'autre
  const confirmedTo = addressProofSent === null ? answers : { ...answers, email: registration.email }
  const emailSent = accepted ? await sendRegistrationConfirmationEmail(registration, confirmedTo, registrationUrl(token)) : null

  return { ...(await exposePublicRegistration(await requireRegistrationByToken(token))), emailSent, keptSessions, addressProofSent }
})
