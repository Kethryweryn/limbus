import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { intrigueSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readZodBody(event, intrigueSchema)
  await validateIntrigueRelations(body.gameId, body.characterIds, body.factionIds)

  return await prisma.intrigue.create({
    data: {
      name: body.name,
      slug: await generateUniqueSlug('intrigue', body.name),
      pitch: body.pitch,
      description: body.description,
      level: body.level,
      gameId: body.gameId,
      published: body.published ?? true,
      characters: {
        connect: body.characterIds.map((id) => ({ id }))
      },
      factions: {
        connect: body.factionIds.map((id) => ({ id }))
      }
    },
    include: {
      game: true,
      characters: { orderBy: { name: 'asc' } },
      factions: { orderBy: { name: 'asc' } },
      items: { orderBy: { name: 'asc' } }
    }
  })
})

async function validateIntrigueRelations(gameId: string, characterIds: string[], factionIds: string[]) {
  if (characterIds.length) {
    const count = await prisma.character.count({
      where: { id: { in: characterIds }, gameId }
    })
    if (count !== characterIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Personnages invalides pour ce jeu' })
    }
  }

  if (factionIds.length) {
    const count = await prisma.faction.count({
      where: { id: { in: factionIds }, gameId }
    })
    if (count !== factionIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Groupes invalides pour ce jeu' })
    }
  }
}
