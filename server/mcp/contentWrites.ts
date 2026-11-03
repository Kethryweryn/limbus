import * as z from 'zod'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import {
  characterRelationSchema,
  createCharacterSchema,
  createGameSchema,
  documentSchema,
  factionSchema,
  intrigueSchema,
  itemSchema,
  locationSchema,
  parseZod,
  timelineEventSchema,
  updateCharacterSchema,
  updateGameSchema
} from '~/server/utils/schemas'
import * as writes from '~/server/utils/contentWrites'
import { AI_LOG_ACTIONS } from '~/utils/aiAssistants'
import { CHARACTER_TYPES, DOCUMENT_AUDIENCES, INTRIGUE_LEVELS } from '~/utils/domain'
import { CHARACTER_RELATION_TYPE_VALUES } from '~/utils/characterRelations'
import { DESTRUCTIVE, WRITE, logWrite, requireWrite, text, toolResult, version, withVersion, type ToolContext } from '~/server/mcp/tools'

// Écriture du contenu d'un jeu par un assistant (US-125, US-126, SPEC-014 R10 à R13) : les fonctions de l'interface
// (contentWrites), avec la version lue, sans lien ni fichier, et chaque écriture notée au journal

const ids = (description: string) => z.array(z.string()).max(500).optional().describe(description)

/** Une sorte d'élément : ses champs écrits par un assistant, et comment compléter une modification avec la fiche actuelle. */
type ContentKind = {
  type: string
  tool: string
  label: string
  fields: z.ZodRawShape
  // Fiche actuelle sous la forme du corps de l'interface, liens et fichiers compris : un champ omis reste tel quel
  current?: (id: string) => Promise<Record<string, unknown> | null>
  create: (event: H3Event, body: Record<string, unknown>) => Promise<{ id: string, gameId: string, updatedAt: Date } & Record<string, unknown>>
  // Le corps est produit dans readBody, après les contrôles d'accès et de version : la fiche actuelle n'est lue qu'alors
  update: (event: H3Event, id: string, makeBody: () => Promise<Record<string, unknown>>) => Promise<{ id: string, gameId: string, updatedAt: Date } & Record<string, unknown>>
  remove: (event: H3Event, id: string) => Promise<unknown>
  find: (id: string) => Promise<{ gameId: string, name: string } | null>
}

const idsOf = (rows: Array<{ id: string }>) => rows.map((row) => row.id)
const nameOf = (record: Record<string, unknown>) => String(record.name ?? record.title ?? record.type ?? '')

const KINDS: ContentKind[] = [
  {
    type: 'character',
    tool: 'personnage',
    label: 'un personnage',
    fields: {
      name: z.string().max(200).optional(),
      type: z.enum([CHARACTER_TYPES.pj, CHARACTER_TYPES.pnj]).optional().describe('pj ou pnj'),
      pitch: text('Accroche'),
      background: text('Histoire du personnage'),
      costumeIndications: text('Indications de costume'),
      balanceValue: z.string().max(100).nullable().optional().describe('Valeur de l’attribut d’équilibre du jeu (PJ seulement)'),
      sheetReadyToSend: z.boolean().optional().describe('Fiche prête à envoyer (rien ne part)'),
      excludeFromTrombinoscope: z.boolean().optional(),
      trombinoscopeFaceHidden: z.boolean().optional(),
      trombinoscopeDisplayName: text('Nom affiché au trombinoscope'),
      trombinoscopeNote: text('Note du trombinoscope'),
      factionIds: ids('Factions du personnage (liste complète)')
    },
    // La modification de l'interface ne touche que les champs donnés : pas besoin de la fiche actuelle
    create: (event, body) => writes.createCharacter(event, async () => parseZod(createCharacterSchema, body)),
    update: (event, id, makeBody) => writes.updateCharacter(event, id, async () => parseZod(updateCharacterSchema, await makeBody())),
    remove: writes.deleteCharacter,
    find: (id) => prisma.character.findUnique({ where: { id }, select: { gameId: true, name: true } })
  },
  {
    type: 'faction',
    tool: 'faction',
    label: 'une faction',
    fields: {
      name: z.string().max(200).optional(),
      pitch: text('Accroche'),
      background: text('Histoire de la faction'),
      costumeIndications: text('Indications de costume'),
      showInTrombinoscope: z.boolean().optional(),
      characterIds: ids('Membres (liste complète)')
    },
    current: async (id) => {
      const faction = await prisma.faction.findUnique({ where: { id }, select: { name: true, pitch: true, background: true, backgroundDocumentUrl: true, costumeIndications: true, showInTrombinoscope: true, gameId: true, characters: { select: { id: true } } } })
      return faction && { ...faction, characters: undefined, characterIds: idsOf(faction.characters) }
    },
    create: (event, body) => writes.createFaction(event, async () => parseZod(factionSchema, body)),
    update: (event, id, makeBody) => writes.updateFaction(event, id, async () => parseZod(factionSchema, await makeBody())),
    remove: writes.deleteFaction,
    find: (id) => prisma.faction.findUnique({ where: { id }, select: { gameId: true, name: true } })
  },
  {
    type: 'intrigue',
    tool: 'intrigue',
    label: 'une intrigue',
    fields: {
      name: z.string().max(200).optional(),
      pitch: text('Accroche'),
      description: text('Déroulé de l’intrigue'),
      level: z.enum(Object.values(INTRIGUE_LEVELS) as [string, ...string[]]).optional(),
      characterIds: ids('Personnages impliqués (liste complète)'),
      factionIds: ids('Factions impliquées (liste complète)')
    },
    current: async (id) => {
      const intrigue = await prisma.intrigue.findUnique({ where: { id }, select: { name: true, pitch: true, description: true, level: true, gameId: true, characters: { select: { id: true } }, factions: { select: { id: true } } } })
      return intrigue && { ...intrigue, characters: undefined, factions: undefined, characterIds: idsOf(intrigue.characters), factionIds: idsOf(intrigue.factions) }
    },
    create: (event, body) => writes.createIntrigue(event, async () => parseZod(intrigueSchema, body)),
    update: (event, id, makeBody) => writes.updateIntrigue(event, id, async () => parseZod(intrigueSchema, await makeBody())),
    remove: writes.deleteIntrigue,
    find: (id) => prisma.intrigue.findUnique({ where: { id }, select: { gameId: true, name: true } })
  },
  {
    type: 'item',
    tool: 'objet',
    label: 'un objet',
    fields: {
      name: z.string().max(200).optional(),
      description: text('Description'),
      quantity: z.number().int().min(1).optional(),
      locationText: text('Où se trouve l’objet'),
      locationCharacterId: z.string().nullable().optional().describe('Personnage qui détient l’objet'),
      characterIds: ids('Personnages liés (liste complète)'),
      intrigueIds: ids('Intrigues liées (liste complète)')
    },
    current: async (id) => {
      const item = await prisma.item.findUnique({ where: { id }, select: { name: true, description: true, quantity: true, locationText: true, locationCharacterId: true, gameId: true, characters: { select: { id: true } }, intrigues: { select: { id: true } } } })
      return item && { ...item, characters: undefined, intrigues: undefined, characterIds: idsOf(item.characters), intrigueIds: idsOf(item.intrigues) }
    },
    create: (event, body) => writes.createItem(event, async () => parseZod(itemSchema, body)),
    update: (event, id, makeBody) => writes.updateItem(event, id, async () => parseZod(itemSchema, await makeBody())),
    remove: writes.deleteItem,
    find: (id) => prisma.item.findUnique({ where: { id }, select: { gameId: true, name: true } })
  },
  {
    type: 'document',
    tool: 'document',
    label: 'un document (texte)',
    fields: {
      title: z.string().max(200).optional(),
      content: text('Texte du document'),
      audience: z.enum(Object.values(DOCUMENT_AUDIENCES) as [string, ...string[]]).optional().describe('Destinataires : targeted (ciblage), everyone, organizers, npcs, kitchen'),
      readyToSend: z.boolean().optional().describe('Prêt à envoyer (rien ne part)'),
      characterId: z.string().nullable().optional().describe('Personnage dont c’est le document'),
      characterIds: ids('Personnages destinataires (liste complète)'),
      factionIds: ids('Factions destinataires (liste complète)')
    },
    current: async (id) => {
      const document = await prisma.document.findUnique({ where: { id }, select: { title: true, content: true, documentUrl: true, audience: true, readyToSend: true, characterId: true, gameId: true, characters: { select: { id: true } }, factions: { select: { id: true } } } })
      return document && { ...document, characters: undefined, factions: undefined, characterIds: idsOf(document.characters), factionIds: idsOf(document.factions) }
    },
    create: (event, body) => writes.createDocument(event, async () => parseZod(documentSchema, body)),
    update: (event, id, makeBody) => writes.updateDocument(event, id, async () => parseZod(documentSchema, await makeBody())),
    remove: writes.deleteDocument,
    find: async (id) => {
      const document = await prisma.document.findUnique({ where: { id }, select: { gameId: true, title: true } })
      return document && { gameId: document.gameId, name: document.title }
    }
  },
  {
    type: 'location',
    tool: 'lieu',
    label: 'un lieu',
    fields: {
      name: z.string().max(200).optional(),
      address: text('Adresse'),
      notes: text('Notes')
    },
    current: (id) => prisma.location.findUnique({ where: { id }, select: { name: true, address: true, notes: true, gameId: true } }),
    create: (event, body) => writes.createLocation(event, async () => parseZod(locationSchema, body)),
    update: (event, id, makeBody) => writes.updateLocation(event, id, async () => parseZod(locationSchema, await makeBody())),
    remove: writes.deleteLocation,
    find: (id) => prisma.location.findUnique({ where: { id }, select: { gameId: true, name: true } })
  },
  {
    type: 'timelineEvent',
    tool: 'evenement',
    label: 'un événement de la chronologie',
    fields: {
      name: z.string().max(200).optional(),
      description: text('Description'),
      day: z.number().int().min(1).optional().describe('Jour du jeu (1, 2…)'),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Heure, au format HH:mm'),
      requiredResponsibles: z.number().int().min(0).optional().describe('Nombre de responsables à prévoir'),
      characterIds: ids('Personnages liés (liste complète)'),
      factionIds: ids('Factions liées (liste complète)'),
      intrigueIds: ids('Intrigues liées (liste complète)'),
      itemIds: ids('Objets liés (liste complète)')
    },
    current: async (id) => {
      const timelineEvent = await prisma.timelineEvent.findUnique({
        where: { id },
        select: { name: true, description: true, day: true, time: true, requiredResponsibles: true, gameId: true, characters: { select: { id: true } }, factions: { select: { id: true } }, intrigues: { select: { id: true } }, items: { select: { id: true } } }
      })
      return timelineEvent && {
        ...timelineEvent, characters: undefined, factions: undefined, intrigues: undefined, items: undefined,
        characterIds: idsOf(timelineEvent.characters), factionIds: idsOf(timelineEvent.factions), intrigueIds: idsOf(timelineEvent.intrigues), itemIds: idsOf(timelineEvent.items)
      }
    },
    create: (event, body) => writes.createTimelineEvent(event, async () => parseZod(timelineEventSchema, body)),
    update: (event, id, makeBody) => writes.updateTimelineEvent(event, id, async () => parseZod(timelineEventSchema, await makeBody())),
    remove: writes.deleteTimelineEvent,
    find: (id) => prisma.timelineEvent.findUnique({ where: { id }, select: { gameId: true, name: true } })
  },
  {
    type: 'characterRelation',
    tool: 'relation',
    label: 'une relation entre deux personnages',
    fields: {
      type: z.enum(CHARACTER_RELATION_TYPE_VALUES).optional(),
      description: text('Description de la relation'),
      fromCharacterId: z.string().optional(),
      fromLabel: z.string().max(200).nullable().optional().describe('Ce que le premier personnage est pour le second'),
      fromVisible: z.boolean().optional().describe('Visible sur la fiche du premier personnage'),
      toCharacterId: z.string().optional(),
      toLabel: z.string().max(200).nullable().optional(),
      toVisible: z.boolean().optional()
    },
    current: (id) => prisma.characterRelation.findUnique({ where: { id }, select: { type: true, description: true, fromCharacterId: true, fromLabel: true, fromVisible: true, toCharacterId: true, toLabel: true, toVisible: true } }),
    create: (event, body) => writes.createCharacterRelation(event, async () => parseZod(characterRelationSchema, body)),
    update: (event, id, makeBody) => writes.updateCharacterRelation(event, id, async () => parseZod(characterRelationSchema, await makeBody())),
    remove: writes.deleteCharacterRelation,
    find: async (id) => {
      const relation = await prisma.characterRelation.findUnique({ where: { id }, select: { gameId: true, type: true } })
      return relation && { gameId: relation.gameId, name: relation.type }
    }
  }
]

const KIND_BY_TOOL = new Map(KINDS.map((kind) => [kind.tool, kind]))

/** Champs donnés, sans ceux omis : `undefined` ne doit pas effacer la valeur actuelle à la fusion. */
function given(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined))
}

/** Corps d'une modification : la fiche actuelle (liens et fichiers compris), puis les seuls champs donnés. */
export function mergedBody(current: Record<string, unknown>, fields: Record<string, unknown>) {
  const body = Object.fromEntries(Object.entries(current).filter(([, value]) => value !== undefined))
  return { ...body, ...given(fields) }
}

function registerSaveTool({ event, server }: ToolContext, kind: ContentKind) {
  const name = `enregistrer_${kind.tool}`
  server.registerTool(name, {
    title: `Enregistrer ${kind.label}`,
    description: `Crée ${kind.label} (sans id, avec jeuId) ou le modifie (avec id et version). Une modification ne change que les champs donnés.`,
    inputSchema: z.object({
      id: z.string().optional().describe('Élément à modifier ; absent, un nouvel élément est créé'),
      version: version.optional(),
      jeuId: z.string().optional().describe('Jeu où créer l’élément'),
      ...kind.fields
    }),
    annotations: WRITE
  }, ({ id, version: read, jeuId, ...fields }: Record<string, unknown>) => toolResult(async () => {
    requireWrite(event)
    let saved
    if (typeof id === 'string') {
      if (typeof read !== 'string') throw createError({ statusCode: 400, message: 'Version requise pour modifier : lisez l’élément d’abord' })
      saved = await withVersion(event, read, () => kind.update(event, id, async () => kind.current
        ? mergedBody(await kind.current(id) ?? {}, fields)
        : given(fields)))
    } else {
      if (typeof jeuId !== 'string' && kind.type !== 'characterRelation') throw createError({ statusCode: 400, message: 'jeuId requis pour créer' })
      saved = await kind.create(event, { ...given(fields), ...(kind.type === 'characterRelation' ? {} : { gameId: jeuId }) })
    }
    await logWrite(event, name, typeof id === 'string' ? AI_LOG_ACTIONS.changed : AI_LOG_ACTIONS.created, { type: kind.type, id: saved.id, name: nameOf(saved), gameId: saved.gameId })
    return { id: saved.id, version: saved.updatedAt }
  }))
}

function registerDeleteTool({ event, server }: ToolContext) {
  server.registerTool('supprimer_contenu', {
    title: 'Supprimer un élément',
    description: 'Supprime définitivement un élément d’un jeu, comme dans Limbus. Demande la version lue.',
    inputSchema: z.object({
      type: z.enum(KINDS.map((kind) => kind.tool) as [string, ...string[]]).describe('Sorte d’élément'),
      id: z.string(),
      version
    }),
    annotations: DESTRUCTIVE
  }, ({ type, id, version: read }) => toolResult(async () => {
    requireWrite(event)
    const kind = KIND_BY_TOOL.get(type)!
    // Nom et jeu lus avant, pour le journal ; la suppression refait elle-même les contrôles d'accès et de version
    const found = await kind.find(id)
    await withVersion(event, read, () => kind.remove(event, id))
    await logWrite(event, 'supprimer_contenu', AI_LOG_ACTIONS.deleted, { type: kind.type, id, name: found?.name ?? '', gameId: found!.gameId })
    return { deleted: true }
  }))
}

// Champs d'un jeu écrits par un assistant : ni page publique, ni photos, ni contact, ni vidéo, ni archivage (R10, R11)
const gameFields = {
  title: z.string().max(200).optional(),
  description: text('Présentation du jeu'),
  noteIntention: text('Note d’intention'),
  singlePjPerParticipant: z.boolean().optional().describe('Un seul PJ par personne'),
  balanceAttribute: z.string().max(100).nullable().optional().describe('Attribut d’équilibre du casting (ex. genre)'),
  balanceValues: z.array(z.string().max(100)).max(20).optional().describe('Valeurs de l’attribut d’équilibre')
}

function registerGameWriteTools({ event, server }: ToolContext) {
  server.registerTool('creer_jeu', {
    title: 'Créer un jeu',
    description: 'Crée un jeu dont la personne est propriétaire ; il s’ajoute aux jeux de cette autorisation.',
    inputSchema: z.object({ ...gameFields, title: z.string().min(1).max(200) }),
    annotations: WRITE
  }, (fields) => toolResult(async () => {
    const ai = requireWrite(event)
    const game = await writes.createGame(event, async () => parseZod(createGameSchema, given(fields)))
    await prisma.aiAuthorizationGame.create({ data: { authorizationId: ai.id, gameId: game.id } })
    ai.gameIds.push(game.id)
    await logWrite(event, 'creer_jeu', AI_LOG_ACTIONS.created, { type: 'game', id: game.id, name: game.title, gameId: game.id })
    return { id: game.id, version: game.updatedAt }
  }))

  server.registerTool('modifier_jeu', {
    title: 'Modifier un jeu',
    description: 'Modifie la présentation d’un jeu (titre, description, note d’intention, équilibre du casting). Ne change que les champs donnés.',
    inputSchema: z.object({ jeuId: z.string(), version, ...gameFields }),
    annotations: WRITE
  }, ({ jeuId, version: read, ...fields }) => toolResult(async () => {
    requireWrite(event)
    const game = await withVersion(event, read, () => writes.updateGame(event, jeuId, async () => parseZod(updateGameSchema, given(fields))))
    await logWrite(event, 'modifier_jeu', AI_LOG_ACTIONS.changed, { type: 'game', id: game.id, name: game.title, gameId: game.id })
    return { id: game.id, version: game.updatedAt }
  }))
}

/** Outils d'écriture : seulement pour une autorisation en lecture et écriture (R4). */
export function registerContentWriteTools(context: ToolContext) {
  if (!context.event.context.aiAuthorization?.canWrite) return
  registerGameWriteTools(context)
  for (const kind of KINDS) registerSaveTool(context, kind)
  registerDeleteTool(context)
}
