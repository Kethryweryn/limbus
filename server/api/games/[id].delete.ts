import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { collectUploadUrls, deleteUnusedUploads } from '~/server/utils/uploads'
import { deletePendingCopy } from '~/server/utils/gameCopy'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  await requireGameOwner(event, id)
  // Seul un jeu archivé se supprime (US-207) : archiver d'abord laisse le temps de se raviser
  const { published } = await prisma.game.findUniqueOrThrow({ where: { id }, select: { published: true } })
  if (published) throw createError({ statusCode: 409, statusMessage: 'Archivez ce jeu avant de le supprimer.' })
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'game', id)

  // Ses legs en attente partent avec lui : sans jeu source, plus personne ne pourrait les suivre ni les annuler (R8)
  const pendingCopies = await prisma.game.findMany({ where: { copiedFromGameId: id, bequestPending: true }, select: { id: true } })
  for (const copy of pendingCopies) {
    await deletePendingCopy(copy.id)
  }

  // Tout le contenu du jeu part en cascade ; les fichiers (photos, RIB) sont effacés ensuite
  const uploadUrls = await collectUploadUrls({ gameId: id })
  await prisma.game.delete({
    where: { id }
  })
  await deleteUnusedUploads(uploadUrls)

  return { success: true }
})
