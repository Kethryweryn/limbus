import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { createGameSchema, readZodBody } from '~/server/utils/schemas'
import { requireCurrentUser } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)
  const user = await requireCurrentUser(event)

  const body = await readZodBody(event, createGameSchema)
  const { title, description, teaserUrl, noteIntention, publicPage } = body

  const slug = await generateUniqueSlug('game', title)

  const game = await prisma.game.create({
    data: {
      title,
      slug,
      description,
      teaserUrl,
      noteIntention,
      ownerId: user.id,
      publicPage: publicPage ?? false
    }
  })

  return game
})
