import * as z from 'zod'
import { prisma } from '~/server/utils/prisma'
import { gameScopedWhere, requireGameAccess } from '~/server/utils/gameAccess'
import { PAGE_SIZE, READ_ONLY, named, pageOf, skipOf, toolResult, type ToolContext } from '~/server/mcp/tools'

// Contenu d'un jeu (R7, R9) : résumé paginé, puis fiche par fiche. Les fichiers (fonds PDF, photos de trombinoscope,
// document téléversé) ne sont jamais rendus

const CONTENT_TYPES = ['personnages', 'factions', 'intrigues', 'objets', 'documents', 'lieux', 'chronologie'] as const
type ContentType = typeof CONTENT_TYPES[number]

const titled = { select: { id: true, title: true } } as const
const contains = (search: string | undefined) => search ? { contains: search, mode: 'insensitive' as const } : undefined

async function listContent(type: ContentType, gameId: string, search: string | undefined, page: number | undefined) {
  const skip = skipOf(page)
  const take = PAGE_SIZE
  const byName = { gameId, ...(search ? { name: contains(search) } : {}) }
  switch (type) {
    case 'personnages': {
      const [items, total] = await Promise.all([
        prisma.character.findMany({ where: byName, orderBy: { name: 'asc' }, skip, take, select: { id: true, name: true, type: true, pitch: true, published: true } }),
        prisma.character.count({ where: byName })
      ])
      return pageOf(items, page, total)
    }
    case 'factions': {
      const [items, total] = await Promise.all([
        prisma.faction.findMany({ where: byName, orderBy: { name: 'asc' }, skip, take, select: { id: true, name: true, pitch: true, published: true } }),
        prisma.faction.count({ where: byName })
      ])
      return pageOf(items, page, total)
    }
    case 'intrigues': {
      const [items, total] = await Promise.all([
        prisma.intrigue.findMany({ where: byName, orderBy: { name: 'asc' }, skip, take, select: { id: true, name: true, pitch: true, level: true, published: true } }),
        prisma.intrigue.count({ where: byName })
      ])
      return pageOf(items, page, total)
    }
    case 'objets': {
      const [items, total] = await Promise.all([
        prisma.item.findMany({ where: byName, orderBy: { name: 'asc' }, skip, take, select: { id: true, name: true, quantity: true, published: true } }),
        prisma.item.count({ where: byName })
      ])
      return pageOf(items, page, total)
    }
    case 'documents': {
      const where = { gameId, ...(search ? { title: contains(search) } : {}) }
      const [items, total] = await Promise.all([
        prisma.document.findMany({ where, orderBy: { title: 'asc' }, skip, take, select: { id: true, title: true, audiences: true, readyToSend: true, published: true } }),
        prisma.document.count({ where })
      ])
      return pageOf(items, page, total)
    }
    case 'lieux': {
      const [items, total] = await Promise.all([
        prisma.location.findMany({ where: byName, orderBy: { name: 'asc' }, skip, take, select: { id: true, name: true, published: true } }),
        prisma.location.count({ where: byName })
      ])
      return pageOf(items, page, total)
    }
    case 'chronologie': {
      const [items, total] = await Promise.all([
        prisma.timelineEvent.findMany({ where: byName, orderBy: [{ day: 'asc' }, { time: 'asc' }, { name: 'asc' }], skip, take, select: { id: true, name: true, day: true, time: true, published: true } }),
        prisma.timelineEvent.count({ where: byName })
      ])
      return pageOf(items, page, total)
    }
  }
}

async function readContent(type: ContentType, where: Record<string, unknown>) {
  const common = { id: true, gameId: true, published: true, updatedAt: true } as const
  switch (type) {
    case 'personnages':
      return await prisma.character.findFirst({
        where,
        select: {
          ...common, name: true, type: true, pitch: true, background: true, costumeIndications: true, balanceValue: true,
          factions: named, intrigues: named, items: named, documents: titled
        }
      })
    case 'factions':
      return await prisma.faction.findFirst({
        where,
        select: { ...common, name: true, pitch: true, background: true, costumeIndications: true, characters: named, intrigues: named }
      })
    case 'intrigues':
      return await prisma.intrigue.findFirst({
        where,
        select: { ...common, name: true, pitch: true, description: true, level: true, characters: named, factions: named, items: named }
      })
    case 'objets':
      return await prisma.item.findFirst({
        where,
        select: { ...common, name: true, description: true, quantity: true, locationText: true, locationCharacter: named, characters: named, intrigues: named }
      })
    case 'documents':
      return await prisma.document.findFirst({
        where,
        select: { ...common, title: true, content: true, audiences: true, readyToSend: true, characters: named, factions: named }
      })
    case 'lieux':
      return await prisma.location.findFirst({ where, select: { ...common, name: true, address: true, notes: true } })
    case 'chronologie':
      return await prisma.timelineEvent.findFirst({
        where,
        select: {
          ...common, name: true, description: true, day: true, time: true, requiredResponsibles: true,
          characters: named, factions: named, intrigues: named, items: named
        }
      })
  }
}

export function registerContentTools({ event, server }: ToolContext) {
  const type = z.enum(CONTENT_TYPES).describe('Sorte d’élément')

  server.registerTool('lister_contenu', {
    title: 'Lister le contenu d’un jeu',
    description: `Résumé paginé (${PAGE_SIZE} par page) des éléments d’une sorte : personnages, factions, intrigues, objets, documents, lieux ou chronologie. Lire ensuite chaque fiche avec lire_contenu.`,
    inputSchema: z.object({
      jeuId: z.string(),
      type,
      recherche: z.string().max(100).optional().describe('Filtre sur le nom ou le titre'),
      page: z.number().int().min(1).optional()
    }),
    annotations: READ_ONLY
  }, ({ jeuId, type, recherche, page }) => toolResult(async () => {
    await requireGameAccess(event, jeuId)
    return await listContent(type, jeuId, recherche, page)
  }))

  server.registerTool('lire_contenu', {
    title: 'Lire une fiche',
    description: 'Fiche complète d’un élément (texte, liens vers les autres éléments), avec sa version (updatedAt).',
    inputSchema: z.object({ type, id: z.string() }),
    annotations: READ_ONLY
  }, ({ type, id }) => toolResult(async () => {
    const found = await readContent(type, await gameScopedWhere(event, { id }))
    if (!found) throw createError({ statusCode: 404, message: 'Élément introuvable' })
    return found
  }))

  server.registerTool('lister_relations', {
    title: 'Relations entre personnages',
    description: 'Relations entre les personnages d’un jeu : type, description, libellé et visibilité de chaque côté, avec leur version (updatedAt).',
    inputSchema: z.object({ jeuId: z.string() }),
    annotations: READ_ONLY
  }, ({ jeuId }) => toolResult(async () => {
    await requireGameAccess(event, jeuId)
    return await prisma.characterRelation.findMany({
      where: { gameId: jeuId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, type: true, description: true, updatedAt: true,
        fromCharacter: named, fromLabel: true, fromVisible: true,
        toCharacter: named, toLabel: true, toVisible: true
      }
    })
  }))
}
