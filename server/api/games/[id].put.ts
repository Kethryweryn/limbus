import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { readZodBody, updateGameSchema } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireGameAccess(event, id)
  await assertUnmodifiedSince(event, 'game', id)

  const body = await readZodBody(event, updateGameSchema)
  const { title, description, teaserUrl, noteIntention, published, publicPage } = body

  const data: any = {
    description,
    teaserUrl,
    noteIntention,
    published,
    publicPage
  }

  if (title) {
    data.title = title
    data.slug = await generateUniqueSlug('game', title, id)
  }

  const game = await prisma.game.update({
    where: { id },
    data
  })

  return game
})
