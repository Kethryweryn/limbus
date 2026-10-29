import { requireOrganizer } from '~/server/utils/auth'
import { findPendingBequest, requireBequestOwner } from '~/server/utils/bequests'
import { deletePendingCopy } from '~/server/utils/gameCopy'
import { requireRouterParam } from '~/server/utils/routeParams'

// Annule un legs en attente : la copie part avec ses fichiers, et son invitation avec elle (US-012, R8)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const invitationId = requireRouterParam(event, 'invitationId')
  await requireBequestOwner(event, id)
  const invitation = await findPendingBequest(id, invitationId)

  // Conditionnel : une copie attribuée entre-temps n'est pas touchée
  if (!await deletePendingCopy(invitation.gameId)) {
    throw createError({ statusCode: 409, message: 'Ce legs vient d’être accepté : la copie appartient maintenant à sa destinataire.' })
  }

  return { success: true }
})
