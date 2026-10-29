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
