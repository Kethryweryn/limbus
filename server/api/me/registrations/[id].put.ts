import { requireUser } from '~/server/utils/auth'
import { readZodBody } from '~/server/utils/schemas'
import { registrationAnswerSchema } from '~/server/utils/registrationForms'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import {
  answerFormDefinition,
  exposeMyRegistration,
  frozenFormVersionId,
  readAvailability,
  requireMyRegistration,
  saveRegistrationAnswers,
  sendRegistrationConfirmationEmail
} from '~/server/utils/publicRegistrations'

// Répondre à l'invitation ou modifier ses réponses depuis le compte, comme par le lien personnel (US-072)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const registration = await requireMyRegistration(user.id, id)
  const form = await answerFormDefinition(registration)
  const { charterAccepted: _charterAccepted, healthConsent: _healthConsent, ...body } = await readZodBody(event, registrationAnswerSchema(form.definition))
  // Depuis le compte, l'adresse est celle du compte : en changer détacherait la fiche en pleine réponse
  const answers = { ...body, email: user.email, availableSessionIds: await readAvailability(event, registration) }

  const versionId = await frozenFormVersionId(registration, form.versionId)
  const { accepted, keptSessions, addressProofSent } = await saveRegistrationAnswers(registration, versionId, answers, form.definition, true)
  // Le lien de l'email mène à l'espace « Je participe » : le jeton du lien personnel n'est pas connu ici
  // Adresse à prouver (US-243) : la confirmation part à l'adresse gardée
  const confirmedTo = addressProofSent === null ? answers : { ...answers, email: registration.email }
  const emailSent = accepted ? await sendRegistrationConfirmationEmail(registration, confirmedTo, absoluteAppUrl('/participer')) : null

  return { ...(await exposeMyRegistration(await requireMyRegistration(user.id, id), user.email)), emailSent, keptSessions, addressProofSent }
})
