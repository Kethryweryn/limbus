import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { selectionOverview } from '~/server/utils/registrationSelection'

// Sessions à remplir et rejoueurs d'une période en mode formulaire (US-087, US-090) ; les inscriptions
// viennent de la liste des périodes
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)

  return await selectionOverview(period.id)
})
