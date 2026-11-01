import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readZodBody, registrationQuestionLinksSchema } from '~/server/utils/schemas'
import { saveQuestionLinks } from '~/server/utils/registrationQuestionLinks'

// Remplace les liens du questionnaire (US-098, ADR-0050) : hors des versions du formulaire
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameId = requireRouterParam(event, 'id')
  await requireGameAccess(event, gameId)
  const body = await readZodBody(event, registrationQuestionLinksSchema)

  return { links: await saveQuestionLinks(gameId, body.links) }
})
