import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { currentQuestionLinks, linkTargets } from '~/server/utils/registrationQuestionLinks'

// Liens du questionnaire et ce qu'on peut relier (US-098) : pour l'éditeur du formulaire
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameId = requireRouterParam(event, 'id')
  await requireGameAccess(event, gameId)

  const [links, targets] = await Promise.all([currentQuestionLinks(gameId), linkTargets(gameId)])
  return { links, targets }
})
