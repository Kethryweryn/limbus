import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { readZodBody, updateGameSchema } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  await requireGameAccess(event, id)
  await assertUnmodifiedSince(event, 'game', id)

  const body = await readZodBody(event, updateGameSchema)
  const { title, description, teaserUrl, noteIntention, published, publicPage, publicShowSessions, publicShowRegistration, singlePjPerParticipant, balanceAttribute, balanceValues, photoRetentionMonths, contactEmail } = body

  const data: any = {
    description,
    teaserUrl,
    noteIntention,
    published,
    publicPage: published === false ? false : publicPage,
    publicShowSessions,
    publicShowRegistration,
    singlePjPerParticipant,
    photoRetentionMonths: photoRetentionMonths ?? undefined,
    ...(contactEmail !== undefined ? { contactEmail: contactEmail || null } : {}),
    // Attribut d'équilibre (US-091) : sans nom, pas de valeurs
    ...(balanceAttribute !== undefined ? { balanceAttribute: balanceAttribute || null } : {}),
    ...(balanceValues !== undefined ? { balanceValues } : {}),
    ...(balanceAttribute === null || balanceAttribute === '' ? { balanceValues: [] } : {})
  }

  if (title) {
    data.title = title
    data.slug = await generateUniqueSlug('game', title, id)
  }

  const game = await prisma.$transaction(async (tx) => {
    // Ligne verrouillée : deux renommages simultanés lisent chacun le slug laissé par l'autre, et la redirection
    // pointe toujours vers l'adresse précédente
    const [previous] = await tx.$queryRaw<Array<{ slug: string }>>`SELECT slug FROM "Game" WHERE id = ${id} FOR UPDATE`
    if (!previous) throw createError({ statusCode: 404, message: 'Jeu introuvable' })
    const updated = await tx.game.update({ where: { id }, data })
    // Une valeur d'équilibre retirée du jeu ne reste pas sur ses personnages (US-091)
    await tx.character.updateMany({ where: { gameId: id, balanceValue: { not: null, notIn: updated.balanceAttribute ? updated.balanceValues : [] } }, data: { balanceValue: null } })
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
