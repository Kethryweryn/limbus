import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationOr404 } from '~/server/utils/registrations'
import { applySelection } from '~/server/utils/registrationSelection'
import { readZodBody, registrationSelectionSchema } from '~/server/utils/schemas'

// Retenir, mettre en liste d'attente ou remettre à sa réponse une personne pour une session (R20) : rien n'est envoyé
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  const body = await readZodBody(event, registrationSelectionSchema)

  return await applySelection(registration.id, body.action, body.sessionId, user)
})
