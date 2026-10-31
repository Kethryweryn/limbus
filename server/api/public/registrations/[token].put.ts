import { readZodBody } from '~/server/utils/schemas'
import { readAvailability } from '~/server/utils/registrationAvailability'
import { registrationAnswerSchema } from '~/server/utils/registrationForms'
import {
  answerFormDefinition,
  exposePublicRegistration,
  frozenFormVersionId,
  guardPublicRegistrationRequest,
  requireRegistrationByToken,
  saveRegistrationAnswers,
  sendRegistrationConfirmationEmail
} from '~/server/utils/publicRegistrations'
import { registrationUrl } from '~/server/utils/registrations'

// Accepter l'invitation, ou modifier une inscription confirmée jusqu'à la clôture (US-004, R13)
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')

  const token = getRouterParam(event, 'token')!
  const registration = await requireRegistrationByToken(token)
  const form = await answerFormDefinition(registration)
  const { charterAccepted: _charterAccepted, healthConsent: _healthConsent, ...answers } = await readZodBody(event, registrationAnswerSchema(form.definition))

  const availableSessionIds = await readAvailability(event, registration)

  const versionId = await frozenFormVersionId(registration, form.versionId)
  const { accepted } = await saveRegistrationAnswers(registration, versionId, { ...answers, availableSessionIds }, form.definition)
  const emailSent = accepted ? await sendRegistrationConfirmationEmail(registration, answers, registrationUrl(token)) : null

  return { ...(await exposePublicRegistration(await requireRegistrationByToken(token))), emailSent }
})
