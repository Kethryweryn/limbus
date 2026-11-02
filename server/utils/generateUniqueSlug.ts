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

// Les modèles à slug ont le même accès par slug : leur délégué Prisma, lu par son nom
type SlugDelegate = {
  findUnique(args: { where: { slug: string }, select: { id: true } }): Promise<{ id: string } | null>
  findMany(args: { where: { OR: Array<{ slug: { startsWith: string } }> }, select: { slug: true } }): Promise<Array<{ slug: string }>>
}
const delegate = (model: SlugModel) => prisma[model] as unknown as SlugDelegate

async function findBySlug(model: SlugModel, slug: string): Promise<{ id: string } | null> {
  return await delegate(model).findUnique({ where: { slug }, select: { id: true } })
}

export async function generateUniqueSlug(model: SlugModel, text: string, excludeId?: string): Promise<string> {
  const baseSlug = generateSlug(text) || slugFallbackByModel[model]
  let slug = baseSlug
  let suffix = 2

  while (true) {
    const existing = await findBySlug(model, slug)
    if (!existing || existing.id === excludeId) return slug

    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

/**
 * Slugs uniques de plusieurs éléments créés ensemble (copie d'un jeu, ADR-0025) : les slugs qui commencent comme les
 * leurs sont lus en une requête, au lieu d'une par essai.
 */
export async function generateUniqueSlugs(model: SlugModel, texts: string[]): Promise<string[]> {
  if (!texts.length) return []
  const bases = texts.map((text) => generateSlug(text) || slugFallbackByModel[model])
  const existing = await delegate(model).findMany({
    where: { OR: [...new Set(bases)].map((base) => ({ slug: { startsWith: base } })) },
    select: { slug: true }
  })
  const taken = new Set(existing.map((row) => row.slug))
  return bases.map((base) => {
    let slug = base
    for (let suffix = 2; taken.has(slug); suffix++) slug = `${base}-${suffix}`
    taken.add(slug)
    return slug
  })
}
