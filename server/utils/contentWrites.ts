import type { H3Event } from 'h3'
import type { z } from 'zod'
import type { Prisma } from '~/generated/prisma/client'
import { legacyAudience } from '~/utils/documentAudiences'
import { prisma } from '~/server/utils/prisma'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { assertSameGame, requireCurrentUser, requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { assertGameUploads, collectUploadUrls, deleteUnusedUploads } from '~/server/utils/uploads'
import { assertBalanceValue } from '~/server/utils/registrationDraws'
import { itemInclude, validateItemRelations } from '~/server/utils/items'
import { documentInclude, validateDocumentRelations } from '~/server/utils/documents'
import { timelineEventInclude, validateTimelineEventRelations } from '~/server/utils/timelineEvents'
import { characterRelationInclude, findCharacterRelationOr404, relationGameId } from '~/server/utils/characterRelations'
import { linkCreate, linkSet, unlinked } from '~/server/utils/contentLinks'
import { factionInclude, intrigueInclude } from '~/server/utils/sheetReads'
import type {
  characterRelationSchema,
  createCharacterSchema,
  createGameSchema,
  documentSchema,
  factionSchema,
  intrigueSchema,
  itemSchema,
  locationSchema,
  timelineEventSchema,
  updateCharacterSchema,
  updateGameSchema
} from '~/server/utils/schemas'
import { CHARACTER_TYPES } from '~/utils/domain'

// Écritures du contenu d'un jeu, communes aux routes de l'interface et aux outils des assistants d'IA (US-126,
// SPEC-014 R12) : mêmes contrôles d'accès, de version, de références du même jeu et de fichiers. Le corps validé est lu
// par `readBody` après les contrôles d'accès et de version, dans l'ordre des routes

type Reader<S extends z.ZodType> = () => Promise<z.output<S>>

async function findOr404<T>(found: Promise<T | null>, message: string) {
  const record = await found
  if (!record) throw createError({ statusCode: 404, message })
  return record
}

/** Références d'un élément vers d'autres éléments : du même jeu seulement. */
async function assertSameGameIds(model: 'character' | 'faction', ids: string[], gameId: string, message: string) {
  if (!ids.length) return
  const count = model === 'character'
    ? await prisma.character.count({ where: { id: { in: ids }, gameId } })
    : await prisma.faction.count({ where: { id: { in: ids }, gameId } })
  if (count !== ids.length) throw createError({ statusCode: 400, message })
}

// Jeux

export async function createGame(event: H3Event, readBody: Reader<typeof createGameSchema>) {
  const user = await requireCurrentUser(event)
  const body = await readBody()
  const { title, description, teaserUrl, noteIntention, publicPage, publicShowSessions, publicShowRegistration, singlePjPerParticipant, balanceAttribute, balanceValues, photoRetentionMonths, contactEmail } = body

  return await prisma.game.create({
    data: {
      title,
      slug: await generateUniqueSlug('game', title),
      description: description ?? '',
      teaserUrl,
      noteIntention,
      ownerId: user.id,
      publicPage: publicPage ?? false,
      publicShowSessions: publicShowSessions ?? false,
      publicShowRegistration: publicShowRegistration ?? false,
      balanceAttribute: balanceAttribute || null,
      balanceValues: balanceAttribute ? balanceValues ?? [] : [],
      singlePjPerParticipant: singlePjPerParticipant ?? true,
      photoRetentionMonths: photoRetentionMonths ?? undefined,
      contactEmail: contactEmail || null
    }
  })
}

export async function updateGame(event: H3Event, id: string, readBody: Reader<typeof updateGameSchema>) {
  await requireGameAccess(event, id)
  await assertUnmodifiedSince(event, 'game', id)

  const body = await readBody()
  const { title, description, teaserUrl, noteIntention, published, publicPage, publicShowSessions, publicShowRegistration, singlePjPerParticipant, balanceAttribute, balanceValues, photoRetentionMonths, contactEmail } = body

  const data: Prisma.GameUpdateInput = {
    description,
    teaserUrl,
    noteIntention,
    published,
    publicPage: published === false ? false : publicPage,
    publicShowSessions,
    publicShowRegistration,
    singlePjPerParticipant,
    photoRetentionMonths: photoRetentionMonths ?? undefined,
    ...(contactEmail !== undefined ? { contactEmail: contactEmail || null } : {}),
    // Attribut d'équilibre (US-091) : sans nom, pas de valeurs
    ...(balanceAttribute !== undefined ? { balanceAttribute: balanceAttribute || null } : {}),
    ...(balanceValues !== undefined ? { balanceValues } : {}),
    ...(balanceAttribute === null || balanceAttribute === '' ? { balanceValues: [] } : {})
  }

  if (title) {
    data.title = title
    data.slug = await generateUniqueSlug('game', title, id)
  }

  const game = await prisma.$transaction(async (tx) => {
    // Ligne verrouillée : deux renommages simultanés lisent chacun le slug laissé par l'autre, et la redirection
    // pointe toujours vers l'adresse précédente
    const [previous] = await tx.$queryRaw<Array<{ slug: string }>>`SELECT slug FROM "Game" WHERE id = ${id} FOR UPDATE`
    if (!previous) throw createError({ statusCode: 404, message: 'Jeu introuvable' })
    const updated = await tx.game.update({ where: { id }, data })
    // Une valeur d'équilibre retirée du jeu ne reste pas sur ses personnages (US-091)
    await tx.character.updateMany({ where: { gameId: id, balanceValue: { not: null, notIn: updated.balanceAttribute ? updated.balanceValues : [] } }, data: { balanceValue: null } })
    // L'ancienne adresse de la page publique redirige vers la nouvelle (US-045, ADR-0035) ; le slug repris
    // par le jeu n'a plus de redirection
    if (updated.slug !== previous.slug) {
      await tx.gameSlugRedirect.deleteMany({ where: { slug: updated.slug } })
      await tx.gameSlugRedirect.upsert({
        where: { slug: previous.slug },
        create: { slug: previous.slug, gameId: id },
        update: { gameId: id, createdAt: new Date() }
      })
    }
    return updated
  })

  // Un jeu archivé n'a pas de page publique, et ne la retrouve pas en étant restauré (US-016). Contrôle
  // après l'écriture : une publication concurrente d'un archivage ne peut pas laisser la marque.
  if (!game.published && game.publicPage) {
    await prisma.game.updateMany({ where: { id, published: false }, data: { publicPage: false } })
    return { ...game, publicPage: false }
  }
  return game
}

// Personnages

const characterInclude = { game: true, factionLinks: { select: { faction: true } } } as const

export async function createCharacter(event: H3Event, readBody: Reader<typeof createCharacterSchema>) {
  const body = await readBody()
  await requireGameAccess(event, body.gameId)
  await assertGameUploads([body.trombinoscopePhotoUrl], body.gameId, { sessionFiles: false, label: 'Photo de trombinoscope' })
  await assertBalanceValue(body.gameId, body.balanceValue)
  await assertSameGameIds('faction', body.factionIds, body.gameId, 'Groupes invalides pour ce jeu')

  return unlinked(await prisma.character.create({
    data: {
      name: body.name,
      type: body.type,
      slug: await generateUniqueSlug('character', body.name),
      pitch: body.pitch,
      background: body.background,
      backgroundDocumentUrl: body.backgroundDocumentUrl,
      sheetReadyToSend: body.sheetReadyToSend ?? false,
      costumeIndications: body.costumeIndications,
      excludeFromTrombinoscope: body.excludeFromTrombinoscope ?? false,
      trombinoscopeFaceHidden: body.trombinoscopeFaceHidden ?? false,
      trombinoscopePhotoUrl: body.trombinoscopePhotoUrl,
      trombinoscopeNote: body.trombinoscopeNote,
      trombinoscopeDisplayName: body.trombinoscopeDisplayName,
      // Seul un PJ porte une valeur d'équilibre (US-091)
      balanceValue: body.type === CHARACTER_TYPES.pj ? body.balanceValue || null : null,
      gameId: body.gameId,
      factionLinks: linkCreate('factionId', body.factionIds)
    },
    include: characterInclude
  }))
}

export async function updateCharacter(event: H3Event, id: string, readBody: Reader<typeof updateCharacterSchema>) {
  const existing = await findOr404(
    prisma.character.findUnique({ where: { id }, select: { gameId: true, trombinoscopePhotoUrl: true, type: true } }),
    'Personnage introuvable'
  )
  await requireGameAccess(event, existing.gameId)
  await assertUnmodifiedSince(event, 'character', id)

  const body = await readBody()
  assertSameGame(existing.gameId, body.gameId)
  const gameId = existing.gameId
  await assertGameUploads([body.trombinoscopePhotoUrl], gameId, { sessionFiles: false, keep: [existing.trombinoscopePhotoUrl], label: 'Photo de trombinoscope' })
  await assertBalanceValue(gameId, body.balanceValue)
  if (body.factionIds) await assertSameGameIds('faction', body.factionIds, gameId, 'Groupes invalides pour ce jeu')

  const data: Prisma.CharacterUpdateInput = {
    pitch: body.pitch,
    type: body.type,
    background: body.background,
    backgroundDocumentUrl: body.backgroundDocumentUrl,
    sheetReadyToSend: body.sheetReadyToSend,
    costumeIndications: body.costumeIndications,
    excludeFromTrombinoscope: body.excludeFromTrombinoscope,
    trombinoscopeFaceHidden: body.trombinoscopeFaceHidden,
    trombinoscopePhotoUrl: body.trombinoscopePhotoUrl,
    trombinoscopeNote: body.trombinoscopeNote,
    trombinoscopeDisplayName: body.trombinoscopeDisplayName,
    // Seul un PJ porte une valeur d'équilibre (US-091)
    ...((body.type ?? existing.type) !== CHARACTER_TYPES.pj ? { balanceValue: null } : body.balanceValue !== undefined ? { balanceValue: body.balanceValue || null } : {})
  }
  if (body.name) {
    data.name = body.name
    data.slug = await generateUniqueSlug('character', body.name, id)
  }
  if (body.factionIds) data.factionLinks = linkSet('factionId', body.factionIds)

  const character = await prisma.character.update({ where: { id }, data, include: characterInclude })
  await deleteUnusedUploads([existing.trombinoscopePhotoUrl])
  return unlinked(character)
}

export async function deleteCharacter(event: H3Event, id: string) {
  const character = await findOr404(prisma.character.findUnique({ where: { id }, select: { gameId: true } }), 'Personnage introuvable')
  await requireGameAccess(event, character.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'character', id)

  // Ses assignations de session partent avec lui, photos comprises
  const uploadUrls = await collectUploadUrls({ characterId: id })
  // Les références facultatives au personnage se vident d'abord : leur clé composée avec le jeu ne s'efface pas seule
  // (ADR-0074)
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.item.updateMany({ where: { locationCharacterId: id }, data: { locationCharacterId: null } })
    await tx.document.updateMany({ where: { characterId: id }, data: { characterId: null } })
    return await tx.character.delete({ where: { id } })
  })
  await deleteUnusedUploads(uploadUrls)
  return deleted
}

// Factions

export async function createFaction(event: H3Event, readBody: Reader<typeof factionSchema>) {
  const body = await readBody()
  await requireGameAccess(event, body.gameId)
  await assertSameGameIds('character', body.characterIds, body.gameId, 'Personnages invalides pour ce jeu')

  return unlinked(await prisma.faction.create({
    data: {
      name: body.name,
      slug: await generateUniqueSlug('faction', body.name),
      pitch: body.pitch,
      background: body.background,
      backgroundDocumentUrl: body.backgroundDocumentUrl,
      costumeIndications: body.costumeIndications,
      showInTrombinoscope: body.showInTrombinoscope ?? false,
      gameId: body.gameId,
      characterLinks: linkCreate('characterId', body.characterIds)
    },
    include: factionInclude
  }))
}

export async function updateFaction(event: H3Event, id: string, readBody: Reader<typeof factionSchema>) {
  const faction = await findOr404(prisma.faction.findUnique({ where: { id }, select: { gameId: true } }), 'Groupe introuvable')
  await requireGameAccess(event, faction.gameId)
  await assertUnmodifiedSince(event, 'faction', id)

  const body = await readBody()
  assertSameGame(faction.gameId, body.gameId)
  await requireGameAccess(event, body.gameId)
  await assertSameGameIds('character', body.characterIds, body.gameId, 'Personnages invalides pour ce jeu')

  return unlinked(await prisma.faction.update({
    where: { id },
    data: {
      name: body.name,
      slug: await generateUniqueSlug('faction', body.name, id),
      pitch: body.pitch,
      background: body.background,
      backgroundDocumentUrl: body.backgroundDocumentUrl,
      costumeIndications: body.costumeIndications,
      showInTrombinoscope: body.showInTrombinoscope ?? false,
      gameId: body.gameId,
      characterLinks: linkSet('characterId', body.characterIds)
    },
    include: factionInclude
  }))
}

export async function deleteFaction(event: H3Event, id: string) {
  const faction = await findOr404(prisma.faction.findUnique({ where: { id }, select: { gameId: true } }), 'Groupe introuvable')
  await requireGameAccess(event, faction.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'faction', id)
  await prisma.faction.delete({ where: { id } })
  return { success: true }
}

// Intrigues

async function validateIntrigueRelations(gameId: string, characterIds: string[], factionIds: string[]) {
  await assertSameGameIds('character', characterIds, gameId, 'Personnages invalides pour ce jeu')
  await assertSameGameIds('faction', factionIds, gameId, 'Groupes invalides pour ce jeu')
}

export async function createIntrigue(event: H3Event, readBody: Reader<typeof intrigueSchema>) {
  const body = await readBody()
  await requireGameAccess(event, body.gameId)
  await validateIntrigueRelations(body.gameId, body.characterIds, body.factionIds)

  return unlinked(await prisma.intrigue.create({
    data: {
      name: body.name,
      slug: await generateUniqueSlug('intrigue', body.name),
      pitch: body.pitch,
      description: body.description,
      level: body.level,
      gameId: body.gameId,
      characterLinks: linkCreate('characterId', body.characterIds),
      factionLinks: linkCreate('factionId', body.factionIds)
    },
    include: intrigueInclude
  }))
}

export async function updateIntrigue(event: H3Event, id: string, readBody: Reader<typeof intrigueSchema>) {
  const intrigue = await findOr404(prisma.intrigue.findUnique({ where: { id }, select: { gameId: true } }), 'Intrigue introuvable')
  await requireGameAccess(event, intrigue.gameId)
  await assertUnmodifiedSince(event, 'intrigue', id)

  const body = await readBody()
  assertSameGame(intrigue.gameId, body.gameId)
  await requireGameAccess(event, body.gameId)
  await validateIntrigueRelations(body.gameId, body.characterIds, body.factionIds)

  return unlinked(await prisma.intrigue.update({
    where: { id },
    data: {
      name: body.name,
      slug: await generateUniqueSlug('intrigue', body.name, id),
      pitch: body.pitch,
      description: body.description,
      level: body.level,
      gameId: body.gameId,
      characterLinks: linkSet('characterId', body.characterIds),
      factionLinks: linkSet('factionId', body.factionIds)
    },
    include: intrigueInclude
  }))
}

export async function deleteIntrigue(event: H3Event, id: string) {
  const intrigue = await findOr404(prisma.intrigue.findUnique({ where: { id }, select: { gameId: true } }), 'Intrigue introuvable')
  await requireGameAccess(event, intrigue.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'intrigue', id)
  await prisma.intrigue.delete({ where: { id } })
  return { success: true }
}

// Objets

export async function createItem(event: H3Event, readBody: Reader<typeof itemSchema>) {
  const body = await readBody()
  await requireGameAccess(event, body.gameId)
  const characterIds = [...new Set(body.characterIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  await validateItemRelations(body.gameId, characterIds, intrigueIds, body.locationCharacterId)

  return unlinked(await prisma.item.create({
    data: {
      name: body.name,
      slug: await generateUniqueSlug('item', body.name),
      description: body.description,
      quantity: body.quantity ?? 1,
      locationText: body.locationCharacterId ? null : body.locationText,
      locationCharacterId: body.locationCharacterId || null,
      gameId: body.gameId,
      characterLinks: linkCreate('characterId', characterIds),
      intrigueLinks: linkCreate('intrigueId', intrigueIds)
    },
    include: itemInclude
  }))
}

export async function updateItem(event: H3Event, id: string, readBody: Reader<typeof itemSchema>) {
  const item = await findOr404(prisma.item.findUnique({ where: { id }, select: { gameId: true } }), 'Objet introuvable')
  await requireGameAccess(event, item.gameId)
  await assertUnmodifiedSince(event, 'item', id)

  const body = await readBody()
  assertSameGame(item.gameId, body.gameId)
  await requireGameAccess(event, body.gameId)
  const characterIds = [...new Set(body.characterIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  await validateItemRelations(body.gameId, characterIds, intrigueIds, body.locationCharacterId)

  return unlinked(await prisma.item.update({
    where: { id },
    data: {
      name: body.name,
      slug: await generateUniqueSlug('item', body.name, id),
      description: body.description,
      quantity: body.quantity,
      locationText: body.locationCharacterId ? null : body.locationText,
      locationCharacterId: body.locationCharacterId || null,
      gameId: body.gameId,
      characterLinks: linkSet('characterId', characterIds),
      intrigueLinks: linkSet('intrigueId', intrigueIds)
    },
    include: itemInclude
  }))
}

export async function deleteItem(event: H3Event, id: string) {
  const item = await findOr404(prisma.item.findUnique({ where: { id }, select: { gameId: true } }), 'Objet introuvable')
  await requireGameAccess(event, item.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'item', id)
  await prisma.item.delete({ where: { id } })
  return { success: true }
}

// Documents

export async function createDocument(event: H3Event, readBody: Reader<typeof documentSchema>) {
  const body = await readBody()
  await requireGameAccess(event, body.gameId)
  const characterIds = [...new Set(body.characterIds)]
  const factionIds = [...new Set(body.factionIds)]
  await validateDocumentRelations(body.gameId, characterIds, factionIds)

  return unlinked(await prisma.document.create({
    data: {
      title: body.title,
      slug: await generateUniqueSlug('document', body.title),
      content: body.content,
      documentUrl: body.documentUrl,
      audiences: body.audiences,
      // Pour le build encore en service pendant un déploiement ; le champ unique « Personnage » n'est plus écrit (ADR-0072)
      audience: legacyAudience(body.audiences),
      readyToSend: body.readyToSend ?? false,
      gameId: body.gameId,
      characterId: null,
      characterLinks: linkCreate('characterId', characterIds),
      factionLinks: linkCreate('factionId', factionIds)
    },
    include: documentInclude
  }))
}

export async function updateDocument(event: H3Event, id: string, readBody: Reader<typeof documentSchema>) {
  const document = await findOr404(prisma.document.findUnique({ where: { id }, select: { gameId: true } }), 'Document introuvable')
  await requireGameAccess(event, document.gameId)
  await assertUnmodifiedSince(event, 'document', id)

  const body = await readBody()
  assertSameGame(document.gameId, body.gameId)
  await requireGameAccess(event, body.gameId)
  const characterIds = [...new Set(body.characterIds)]
  const factionIds = [...new Set(body.factionIds)]
  await validateDocumentRelations(body.gameId, characterIds, factionIds)

  return unlinked(await prisma.document.update({
    where: { id },
    data: {
      title: body.title,
      slug: await generateUniqueSlug('document', body.title, id),
      content: body.content,
      documentUrl: body.documentUrl,
      audiences: body.audiences,
      // Pour le build encore en service pendant un déploiement ; le champ unique « Personnage » n'est plus écrit (ADR-0072)
      audience: legacyAudience(body.audiences),
      readyToSend: body.readyToSend ?? false,
      gameId: body.gameId,
      characterId: null,
      characterLinks: linkSet('characterId', characterIds),
      factionLinks: linkSet('factionId', factionIds)
    },
    include: documentInclude
  }))
}

export async function deleteDocument(event: H3Event, id: string) {
  const document = await findOr404(prisma.document.findUnique({ where: { id }, select: { gameId: true } }), 'Document introuvable')
  await requireGameAccess(event, document.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'document', id)
  await prisma.document.delete({ where: { id } })
  return { ok: true }
}

// Lieux

export async function createLocation(event: H3Event, readBody: Reader<typeof locationSchema>) {
  const { name, address, notes, gameId } = await readBody()
  await requireGameAccess(event, gameId)

  return await prisma.location.create({
    data: { name, slug: await generateUniqueSlug('location', name), address: address || null, notes: notes || null, gameId },
    include: { game: true }
  })
}

export async function updateLocation(event: H3Event, id: string, readBody: Reader<typeof locationSchema>) {
  const location = await findOr404(prisma.location.findUnique({ where: { id }, select: { gameId: true } }), 'Lieu introuvable')
  await requireGameAccess(event, location.gameId)
  await assertUnmodifiedSince(event, 'location', id)

  const body = await readBody()
  assertSameGame(location.gameId, body.gameId)
  const { name, address, notes, gameId } = body
  await requireGameAccess(event, gameId)

  return await prisma.location.update({
    where: { id },
    data: { name, slug: await generateUniqueSlug('location', name, id), address: address || null, notes: notes || null, gameId },
    include: { game: true }
  })
}

export async function deleteLocation(event: H3Event, id: string) {
  const location = await findOr404(prisma.location.findUnique({ where: { id }, select: { gameId: true } }), 'Lieu introuvable')
  await requireGameAccess(event, location.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'location', id)

  await prisma.session.updateMany({ where: { locationId: id }, data: { locationId: null } })
  return await prisma.location.delete({ where: { id } })
}

// Chronologie

export async function createTimelineEvent(event: H3Event, readBody: Reader<typeof timelineEventSchema>) {
  const body = await readBody()
  await requireGameAccess(event, body.gameId)
  const characterIds = [...new Set(body.characterIds)]
  const factionIds = [...new Set(body.factionIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  const itemIds = [...new Set(body.itemIds)]
  await validateTimelineEventRelations(body.gameId, characterIds, factionIds, intrigueIds, itemIds)

  return unlinked(await prisma.timelineEvent.create({
    data: {
      name: body.name,
      slug: await generateUniqueSlug('timelineEvent', body.name),
      description: body.description,
      day: body.day,
      time: body.time,
      requiredResponsibles: body.requiredResponsibles,
      gameId: body.gameId,
      characterLinks: linkCreate('characterId', characterIds),
      factionLinks: linkCreate('factionId', factionIds),
      intrigueLinks: linkCreate('intrigueId', intrigueIds),
      itemLinks: linkCreate('itemId', itemIds)
    },
    include: timelineEventInclude
  }))
}

export async function updateTimelineEvent(event: H3Event, id: string, readBody: Reader<typeof timelineEventSchema>) {
  const timelineEvent = await findOr404(prisma.timelineEvent.findUnique({ where: { id }, select: { gameId: true } }), 'Événement introuvable')
  await requireGameAccess(event, timelineEvent.gameId)
  await assertUnmodifiedSince(event, 'timelineEvent', id)

  const body = await readBody()
  assertSameGame(timelineEvent.gameId, body.gameId)
  await requireGameAccess(event, body.gameId)
  const characterIds = [...new Set(body.characterIds)]
  const factionIds = [...new Set(body.factionIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  const itemIds = [...new Set(body.itemIds)]
  await validateTimelineEventRelations(body.gameId, characterIds, factionIds, intrigueIds, itemIds)

  return unlinked(await prisma.timelineEvent.update({
    where: { id },
    data: {
      name: body.name,
      slug: await generateUniqueSlug('timelineEvent', body.name, id),
      description: body.description,
      day: body.day,
      time: body.time,
      requiredResponsibles: body.requiredResponsibles,
      gameId: body.gameId,
      characterLinks: linkSet('characterId', characterIds),
      factionLinks: linkSet('factionId', factionIds),
      intrigueLinks: linkSet('intrigueId', intrigueIds),
      itemLinks: linkSet('itemId', itemIds)
    },
    include: timelineEventInclude
  }))
}

export async function deleteTimelineEvent(event: H3Event, id: string) {
  const timelineEvent = await findOr404(prisma.timelineEvent.findUnique({ where: { id }, select: { gameId: true } }), 'Événement introuvable')
  await requireGameAccess(event, timelineEvent.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'timelineEvent', id)
  await prisma.timelineEvent.delete({ where: { id } })
  return { ok: true }
}

// Relations entre personnages (US-097, ADR-0050)

export async function createCharacterRelation(event: H3Event, readBody: Reader<typeof characterRelationSchema>) {
  const body = await readBody()
  const gameId = await relationGameId(body.fromCharacterId, body.toCharacterId)
  await requireGameAccess(event, gameId)
  return await prisma.characterRelation.create({ data: { ...body, gameId }, include: characterRelationInclude })
}

export async function updateCharacterRelation(event: H3Event, id: string, readBody: Reader<typeof characterRelationSchema>) {
  const relation = await findCharacterRelationOr404(id)
  await requireGameAccess(event, relation.gameId)
  await assertUnmodifiedSince(event, 'characterRelation', id)

  const body = await readBody()
  assertSameGame(relation.gameId, await relationGameId(body.fromCharacterId, body.toCharacterId))
  return await prisma.characterRelation.update({ where: { id }, data: body, include: characterRelationInclude })
}

export async function deleteCharacterRelation(event: H3Event, id: string) {
  const relation = await findCharacterRelationOr404(id)
  await requireGameAccess(event, relation.gameId)
  // Suppression rejouée hors ligne : refusée si la relation a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'characterRelation', id)
  await prisma.characterRelation.delete({ where: { id } })
  return { success: true }
}
