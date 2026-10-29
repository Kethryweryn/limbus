import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { requireGameAccess, assertSameGame } from '~/server/utils/gameAccess'
import { intrigueSchema, readZodBody } from '~/server/utils/schemas'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const intrigue = await prisma.intrigue.findUnique({ where: { id }, select: { gameId: true } })
  if (!intrigue) {
    throw createError({ statusCode: 404, message: 'Intrigue introuvable' })
  }
  await requireGameAccess(event, intrigue.gameId)
  await assertUnmodifiedSince(event, 'intrigue', id)

  const body = await readZodBody(event, intrigueSchema)
  assertSameGame(intrigue.gameId, body.gameId)
  await requireGameAccess(event, body.gameId)
  await validateIntrigueRelations(body.gameId, body.characterIds, body.factionIds)

  return await prisma.intrigue.update({
    where: { id },
    data: {
      name: body.name,
      slug: await generateUniqueSlug('intrigue', body.name, id),
      pitch: body.pitch,
      description: body.description,
      level: body.level,
      gameId: body.gameId,
      characters: {
        set: body.characterIds.map((characterId) => ({ id: characterId }))
      },
      factions: {
        set: body.factionIds.map((factionId) => ({ id: factionId }))
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
      throw createError({ statusCode: 400, message: 'Personnages invalides pour ce jeu' })
    }
  }

  if (factionIds.length) {
    const count = await prisma.faction.count({
      where: { id: { in: factionIds }, gameId }
    })
    if (count !== factionIds.length) {
      throw createError({ statusCode: 400, message: 'Groupes invalides pour ce jeu' })
    }
  }
}
