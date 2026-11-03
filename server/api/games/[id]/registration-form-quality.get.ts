import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { questionnaireQuality } from '~/server/utils/questionnaireQuality'

// Repères sur le questionnaire de casting (US-133, SPEC-015) : réservés à l'équipe du jeu
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameId = requireRouterParam(event, 'id')
  await requireGameAccess(event, gameId)

  return await questionnaireQuality(gameId)
})
