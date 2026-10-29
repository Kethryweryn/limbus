import { requireUser } from '~/server/utils/auth'
import { readZodBody } from '~/server/utils/schemas'
import { registrationAnswerSchema } from '~/server/utils/registrationForms'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import {
  answerFormDefinition,
  exposePublicRegistration,
  frozenFormVersionId,
  requireMyRegistration,
  saveRegistrationAnswers,
  sendRegistrationConfirmationEmail
} from '~/server/utils/publicRegistrations'

// Accepter l'invitation ou modifier son inscription depuis le compte, comme par le lien personnel (US-072)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const registration = await requireMyRegistration(user.id, id)
  const form = await answerFormDefinition(registration)
  const { charterAccepted: _charterAccepted, healthConsent: _healthConsent, ...answers } = await readZodBody(event, registrationAnswerSchema(form.definition))

  const versionId = await frozenFormVersionId(registration, form.versionId)
  const { accepted } = await saveRegistrationAnswers(registration, versionId, answers)
  // Le lien de l'email mène à l'espace « Je participe » : le jeton du lien personnel n'est pas connu ici
  const emailSent = accepted ? await sendRegistrationConfirmationEmail(registration, answers, absoluteAppUrl('/participer')) : null

  return { ...(await exposePublicRegistration(await requireMyRegistration(user.id, id))), emailSent }
})
