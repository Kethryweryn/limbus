import { randomUUID } from 'node:crypto'
import { copyFile, unlink } from 'node:fs/promises'
import { extname } from 'node:path'
import { prisma } from '~/server/utils/prisma'
import { generateUniqueSlug, type SlugModel } from '~/server/utils/generateUniqueSlug'
import { uploadFilePath } from '~/server/utils/uploads'
import { isUploadUrl, PHOTO_UPLOAD_PREFIX } from '~/utils/urls'

/**
 * Champs de chaque modèle de contenu, classés pour la copie d'un jeu (SPEC-002 R4, R5, ADR-0025) :
 * - copied : repris tels quels ;
 * - remapped : identifiants d'un autre élément ou URL de fichier, remplacés par ceux de la copie ;
 * - relinked : relations recréées entre les éléments de la copie ;
 * - omitted : propre au jeu source ou régénéré (identifiant, slug, dates), ou non copié (R5).
 * Un test vérifie que chaque champ du schéma Prisma est classé : un champ ajouté oblige à décider.
 */
export const GAME_COPY_FIELDS = {
  Game: {
    copied: ['title', 'description', 'noteIntention', 'teaserUrl'],
    remapped: [],
    relinked: ['characters', 'factions', 'intrigues', 'items', 'timelineEvents', 'documents', 'locations', 'uploadedFiles', 'registrationForm'],
    // La copie démarre active, sans page publique (R10), avec son propre crédit (R11 à R13)
    omitted: ['id', 'slug', 'ownerId', 'createdAt', 'updatedAt', 'published', 'publicPage', 'creditSourceTitle', 'creditAuthorName', 'copiedFromGameId', 'bequestPending', 'owner', 'copiedFrom', 'copies', 'sessions', 'participantLinks', 'shares', 'invitations', 'registrationPeriods']
  },
  Character: {
    copied: ['name', 'type', 'pitch', 'background', 'backgroundDocumentUrl', 'sheetReadyToSend', 'costumeIndications', 'excludeFromTrombinoscope', 'trombinoscopeFaceHidden', 'trombinoscopeNote', 'trombinoscopeDisplayName', 'published'],
    remapped: ['trombinoscopePhotoUrl'],
    relinked: ['factions', 'intrigues', 'documents', 'targetedDocuments', 'items', 'locatedItems', 'timelineEvents', 'trombinoscopeViewerEntries', 'trombinoscopeTargetEntries'],
    omitted: ['id', 'slug', 'gameId', 'createdAt', 'updatedAt', 'game', 'sessionAssignments', 'documentDeliveries', 'trombinoscopeDocuments']
  },
  CharacterTrombinoscopeEntry: {
    copied: ['included', 'faceKnown', 'displayName', 'note'],
    remapped: ['viewerCharacterId', 'targetCharacterId'],
    relinked: ['viewerCharacter', 'targetCharacter'],
    omitted: ['id', 'createdAt', 'updatedAt']
  },
  Faction: {
    copied: ['name', 'pitch', 'background', 'backgroundDocumentUrl', 'costumeIndications', 'showInTrombinoscope', 'published'],
    remapped: [],
    relinked: ['characters', 'intrigues', 'timelineEvents', 'documents'],
    omitted: ['id', 'slug', 'gameId', 'createdAt', 'updatedAt', 'game']
  },
  Intrigue: {
    copied: ['name', 'pitch', 'description', 'level', 'published'],
    remapped: [],
    relinked: ['characters', 'factions', 'items', 'timelineEvents'],
    omitted: ['id', 'slug', 'gameId', 'createdAt', 'updatedAt', 'game']
  },
  Item: {
    copied: ['name', 'description', 'quantity', 'locationText', 'published'],
    remapped: ['locationCharacterId'],
    relinked: ['locationCharacter', 'characters', 'intrigues', 'timelineEvents'],
    omitted: ['id', 'slug', 'gameId', 'createdAt', 'updatedAt', 'game']
  },
  TimelineEvent: {
    copied: ['name', 'description', 'day', 'time', 'requiredResponsibles', 'published'],
    remapped: [],
    relinked: ['characters', 'factions', 'intrigues', 'items'],
    omitted: ['id', 'slug', 'gameId', 'createdAt', 'updatedAt', 'game', 'responsibles']
  },
  Document: {
    copied: ['title', 'content', 'documentUrl', 'audience', 'readyToSend', 'published'],
    remapped: ['characterId'],
    relinked: ['character', 'characters', 'factions'],
    omitted: ['id', 'slug', 'gameId', 'createdAt', 'updatedAt', 'game', 'deliveries']
  },
  Location: {
    copied: ['name', 'address', 'notes', 'published'],
    remapped: [],
    relinked: [],
    omitted: ['id', 'slug', 'gameId', 'createdAt', 'updatedAt', 'game', 'sessions']
  },
  RegistrationForm: {
    copied: [],
    remapped: [],
    relinked: ['versions'],
    omitted: ['id', 'gameId', 'createdAt', 'updatedAt', 'game']
  },
  // Seule la version en vigueur est copiée, et devient la version 1 (R14)
  RegistrationFormVersion: {
    copied: ['definition'],
    remapped: [],
    relinked: ['form'],
    omitted: ['id', 'formId', 'number', 'createdAt', 'registrations']
  }
} as const satisfies Record<string, { copied: readonly string[], remapped: readonly string[], relinked: readonly string[], omitted: readonly string[] }>

type CopiedModel = keyof typeof GAME_COPY_FIELDS

// Typé `any` : chaque modèle a ses champs, et la liste est contrôlée par un test plutôt que par le typage
function pickCopied(model: CopiedModel, row: Record<string, any>): any {
  return Object.fromEntries(GAME_COPY_FIELDS[model].copied.map((field) => [field, row[field]]))
}

async function loadSourceGame(gameId: string) {
  const ids = { select: { id: true } }
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      characters: { orderBy: { createdAt: 'asc' }, include: { trombinoscopeViewerEntries: true } },
      factions: { orderBy: { createdAt: 'asc' }, include: { characters: ids, intrigues: ids } },
      intrigues: { orderBy: { createdAt: 'asc' }, include: { characters: ids } },
      items: { orderBy: { createdAt: 'asc' }, include: { characters: ids, intrigues: ids } },
      timelineEvents: { orderBy: { createdAt: 'asc' }, include: { characters: ids, factions: ids, intrigues: ids, items: ids } },
      documents: { orderBy: { createdAt: 'asc' }, include: { characters: ids, factions: ids } },
      locations: { orderBy: { createdAt: 'asc' } },
      registrationForm: { include: { versions: { orderBy: { number: 'desc' }, take: 1 } } }
    }
  })
  if (!game) {
    throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  }
  return game
}

// Duplique les photos téléversées sous un nouveau nom (R6). Un fichier absent du disque n'est pas repris.
async function duplicatePhotos(urls: Array<string | null>) {
  const copies = new Map<string, string | null>()
  for (const url of new Set(urls)) {
    if (!url || !isUploadUrl(url, PHOTO_UPLOAD_PREFIX)) continue
    const filename = `${randomUUID()}${extname(url)}`
    const newUrl = `${PHOTO_UPLOAD_PREFIX}${filename}`
    try {
      await copyFile(uploadFilePath(url)!, uploadFilePath(newUrl)!)
      copies.set(url, newUrl)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        await removeFiles([...copies.values()])
        throw error
      }
      copies.set(url, null)
    }
  }
  return copies
}

async function removeFiles(urls: Array<string | null>) {
  for (const url of urls) {
    if (!url) continue
    await unlink(uploadFilePath(url)!).catch(() => {})
  }
}

async function slugsFor(model: SlugModel, names: string[]) {
  const taken = new Set<string>()
  const slugs: string[] = []
  for (const name of names) {
    slugs.push(await generateUniqueSlug(model, name, undefined, taken))
  }
  return slugs
}

export interface GameCopyOptions {
  ownerId: string | null
  creditSourceTitle: string
  creditAuthorName: string | null
  bequestPending?: boolean
}

/**
 * Copie le contenu d'écriture d'un jeu dans un nouveau jeu (SPEC-002, ADR-0025) : une seule transaction,
 * liens recréés vers les éléments de la copie, photos dupliquées avant la transaction et effacées si elle échoue.
 */
export async function copyGame(sourceGameId: string, options: GameCopyOptions) {
  const source = await loadSourceGame(sourceGameId)

  const [gameSlug] = await slugsFor('game', [source.title])
  const characterSlugs = await slugsFor('character', source.characters.map((row) => row.name))
  const factionSlugs = await slugsFor('faction', source.factions.map((row) => row.name))
  const intrigueSlugs = await slugsFor('intrigue', source.intrigues.map((row) => row.name))
  const itemSlugs = await slugsFor('item', source.items.map((row) => row.name))
  const eventSlugs = await slugsFor('timelineEvent', source.timelineEvents.map((row) => row.name))
  const documentSlugs = await slugsFor('document', source.documents.map((row) => row.title))
  const locationSlugs = await slugsFor('location', source.locations.map((row) => row.name))

  const photoCopies = await duplicatePhotos(source.characters.map((row) => row.trombinoscopePhotoUrl))
  const copiedPhoto = (url: string | null) => (url && photoCopies.has(url) ? photoCopies.get(url)! : url)

  try {
    return await prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          ...pickCopied('Game', source),
          slug: gameSlug!,
          ownerId: options.ownerId,
          published: true,
          publicPage: false,
          creditSourceTitle: options.creditSourceTitle,
          creditAuthorName: options.creditAuthorName,
          copiedFromGameId: source.id,
          bequestPending: options.bequestPending ?? false
        },
        select: { id: true, title: true, slug: true }
      })
      const gameId = game.id

      const newIds = new Map<string, string>()
      const mapped = (id: string | null) => (id ? newIds.get(id) ?? null : null)
      const connect = (rows: Array<{ id: string }>) => ({ connect: rows.map((row) => ({ id: newIds.get(row.id)! })) })

      // Les slugs sont uniques : ils relient chaque ligne créée à sa ligne source
      const characters = await tx.character.createManyAndReturn({
        data: source.characters.map((row, index) => ({
          ...pickCopied('Character', row),
          trombinoscopePhotoUrl: copiedPhoto(row.trombinoscopePhotoUrl),
          slug: characterSlugs[index]!,
          gameId
        })),
        select: { id: true, slug: true }
      })
      const characterIdBySlug = new Map(characters.map((row) => [row.slug, row.id]))
      source.characters.forEach((row, index) => newIds.set(row.id, characterIdBySlug.get(characterSlugs[index]!)!))

      await tx.characterTrombinoscopeEntry.createMany({
        data: source.characters.flatMap((row) => row.trombinoscopeViewerEntries.map((entry) => ({
          ...pickCopied('CharacterTrombinoscopeEntry', entry),
          viewerCharacterId: newIds.get(entry.viewerCharacterId)!,
          targetCharacterId: newIds.get(entry.targetCharacterId)!
        })))
      })

      for (const [index, row] of source.intrigues.entries()) {
        const created = await tx.intrigue.create({
          data: { ...pickCopied('Intrigue', row), slug: intrigueSlugs[index]!, gameId, characters: connect(row.characters) },
          select: { id: true }
        })
        newIds.set(row.id, created.id)
      }

      for (const [index, row] of source.factions.entries()) {
        const created = await tx.faction.create({
          data: {
            ...pickCopied('Faction', row),
            slug: factionSlugs[index]!,
            gameId,
            characters: connect(row.characters),
            intrigues: connect(row.intrigues)
          },
          select: { id: true }
        })
        newIds.set(row.id, created.id)
      }

      for (const [index, row] of source.items.entries()) {
        const created = await tx.item.create({
          data: {
            ...pickCopied('Item', row),
            slug: itemSlugs[index]!,
            gameId,
            locationCharacterId: mapped(row.locationCharacterId),
            characters: connect(row.characters),
            intrigues: connect(row.intrigues)
          },
          select: { id: true }
        })
        newIds.set(row.id, created.id)
      }

      for (const [index, row] of source.timelineEvents.entries()) {
        await tx.timelineEvent.create({
          data: {
            ...pickCopied('TimelineEvent', row),
            slug: eventSlugs[index]!,
            gameId,
            characters: connect(row.characters),
            factions: connect(row.factions),
            intrigues: connect(row.intrigues),
            items: connect(row.items)
          }
        })
      }

      for (const [index, row] of source.documents.entries()) {
        await tx.document.create({
          data: {
            ...pickCopied('Document', row),
            slug: documentSlugs[index]!,
            gameId,
            characterId: mapped(row.characterId),
            characters: connect(row.characters),
            factions: connect(row.factions)
          }
        })
      }

      if (source.locations.length) {
        await tx.location.createMany({
          data: source.locations.map((row, index) => ({ ...pickCopied('Location', row), slug: locationSlugs[index]!, gameId }))
        })
      }

      const currentVersion = source.registrationForm?.versions[0]
      if (currentVersion) {
        await tx.registrationForm.create({
          data: { gameId, versions: { create: { ...pickCopied('RegistrationFormVersion', currentVersion), number: 1 } } }
        })
      }

      const duplicated = [...photoCopies.values()].filter((url): url is string => Boolean(url))
      if (duplicated.length) {
        await tx.uploadedFile.createMany({
          data: duplicated.map((url) => ({
            kind: 'session-assignment-photo',
            filename: url.slice(PHOTO_UPLOAD_PREFIX.length),
            url,
            gameId
          }))
        })
      }

      return game
    }, { maxWait: 10_000, timeout: 120_000 })
  } catch (error) {
    await removeFiles([...photoCopies.values()])
    throw error
  }
}
