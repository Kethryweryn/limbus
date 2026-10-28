import { prisma } from '~/server/utils/prisma'
import { generateSlug } from '~/server/utils/generateSlug'

export type SlugModel = 'game' | 'character' | 'faction' | 'intrigue' | 'item' | 'timelineEvent' | 'participant' | 'location' | 'session' | 'document'

const slugFallbackByModel: Record<SlugModel, string> = {
  game: 'jeu',
  character: 'personnage',
  faction: 'groupe',
  intrigue: 'intrigue',
  item: 'objet',
  timelineEvent: 'evenement',
  participant: 'participant',
  location: 'lieu',
  session: 'session',
  document: 'document'
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

  if (model === 'session') {
    return prisma.session.findUnique({ where: { slug }, select: { id: true } })
  }

  return prisma.document.findUnique({ where: { slug }, select: { id: true } })
}

// `taken` : slugs déjà réservés mais pas encore en base (copie d'un jeu, ADR-0025)
export async function generateUniqueSlug(model: SlugModel, text: string, excludeId?: string, taken?: Set<string>): Promise<string> {
  const baseSlug = generateSlug(text) || slugFallbackByModel[model]
  let slug = baseSlug
  let suffix = 2

  while (true) {
    const existing = taken?.has(slug) ? { id: '' } : await findBySlug(model, slug)

    if (!existing || existing.id === excludeId) {
      taken?.add(slug)
      return slug
    }

    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }
}
