import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { readZodBody, updateGameSchema } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  await requireGameAccess(event, id)
  await assertUnmodifiedSince(event, 'game', id)

  const body = await readZodBody(event, updateGameSchema)
  const { title, description, teaserUrl, noteIntention, published, publicPage, singlePjPerParticipant } = body

  const data: any = {
    description,
    teaserUrl,
    noteIntention,
    published,
    publicPage: published === false ? false : publicPage,
    singlePjPerParticipant
  }

  if (title) {
    data.title = title
    data.slug = await generateUniqueSlug('game', title, id)
  }

  const previous = await prisma.game.findUniqueOrThrow({ where: { id }, select: { slug: true } })
  const game = await prisma.$transaction(async (tx) => {
    const updated = await tx.game.update({ where: { id }, data })
    // L'ancienne adresse de la page publique redirige vers la nouvelle (US-045, ADR-0035) ; le slug repris
    // par le jeu n'a plus de redirection
    if (updated.slug !== previous.slug) {
      await tx.gameSlugRedirect.deleteMany({ where: { slug: updated.slug } })
      await tx.gameSlugRedirect.upsert({
        where: { slug: previous.slug },
        create: { slug: previous.slug, gameId: id },
        update: { gameId: id, createdAt: new Date() }
      })
    }
    return updated
  })

  // Un jeu archivé n'a pas de page publique, et ne la retrouve pas en étant restauré (US-016). Contrôle
  // après l'écriture : une publication concurrente d'un archivage ne peut pas laisser la marque.
  if (!game.published && game.publicPage) {
    await prisma.game.updateMany({ where: { id, published: false }, data: { publicPage: false } })
    return { ...game, publicPage: false }
  }
  return game
})
