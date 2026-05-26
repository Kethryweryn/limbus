import { prisma } from '~/server/utils/prisma'
import { generateSlug } from '~/server/utils/generateSlug'

type SlugModel = 'game' | 'character' | 'faction' | 'intrigue' | 'item' | 'timelineEvent' | 'participant' | 'location' | 'session'

const slugFallbackByModel: Record<SlugModel, string> = {
  game: 'jeu',
  character: 'personnage',
  faction: 'groupe',
  intrigue: 'intrigue',
  item: 'objet',
  timelineEvent: 'evenement',
  participant: 'participant',
  location: 'lieu',
  session: 'session'
}

async function findBySlug(model: SlugModel, slug: string): Promise<{ id: string } | null> {
  if (model === 'game') {
    return prisma.game.findUnique({ where: { slug }, select: { id: true } })
  }

  if (model === 'character') {
    return prisma.character.findUnique({ where: { slug }, select: { id: true } })
  }

  if (model === 'faction') {
    return prisma.faction.findUnique({ where: { slug }, select: { id: true } })
  }

  if (model === 'intrigue') {
    return prisma.intrigue.findUnique({ where: { slug }, select: { id: true } })
  }

  if (model === 'item') {
    return prisma.item.findUnique({ where: { slug }, select: { id: true } })
  }

  if (model === 'timelineEvent') {
    return prisma.timelineEvent.findUnique({ where: { slug }, select: { id: true } })
  }

  if (model === 'participant') {
    return prisma.participant.findUnique({ where: { slug }, select: { id: true } })
  }

  if (model === 'location') {
    return prisma.location.findUnique({ where: { slug }, select: { id: true } })
  }

  return prisma.session.findUnique({ where: { slug }, select: { id: true } })
}

export async function generateUniqueSlug(model: SlugModel, text: string, excludeId?: string): Promise<string> {
  const baseSlug = generateSlug(text) || slugFallbackByModel[model]
  let slug = baseSlug
  let suffix = 2

  while (true) {
    const existing = await findBySlug(model, slug)

    if (!existing || existing.id === excludeId) {
      return slug
    }

    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }
}
