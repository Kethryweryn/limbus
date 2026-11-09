import { randomUUID } from 'node:crypto'
import { copyFile, unlink } from 'node:fs/promises'
import { extname } from 'node:path'
import type { Prisma } from '~/generated/prisma/client'
import { prisma } from '~/server/utils/prisma'
import { generateUniqueSlugs } from '~/server/utils/generateUniqueSlug'
import { collectUploadUrls, deleteUnusedUploads, uploadFilePath } from '~/server/utils/uploads'
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
    copied: ['title', 'description', 'noteIntention', 'teaserUrl', 'singlePjPerParticipant', 'balanceAttribute', 'balanceValues', 'photoRetentionMonths'],
    remapped: [],
    relinked: ['characters', 'factions', 'intrigues', 'items', 'timelineEvents', 'documents', 'locations', 'uploadedFiles', 'registrationForm', 'characterRelations', 'registrationQuestionLinks', 'registrationOptionExpectations'],
    // La copie démarre active, sans page publique (R10), avec son propre crédit (R11 à R13), sans transfert en cours,
    // sans assistant d'IA ni réglage pour eux (SPEC-014)
    omitted: ['id', 'slug', 'ownerId', 'createdAt', 'updatedAt', 'published', 'publicPage', 'publicShowSessions', 'publicShowRegistration', 'creditSourceTitle', 'creditAuthorName', 'copiedFromGameId', 'bequestPending', 'owner', 'copiedFrom', 'copies', 'sessions', 'participantLinks', 'shares', 'invitations', 'registrationPeriods', 'slugRedirects', 'transferToUserId', 'transferTo', 'contactEmail', 'aiForCoorganizers', 'aiAuthorizationGames', 'aiLogEntries']
  },
  Character: {
    copied: ['name', 'type', 'pitch', 'background', 'backgroundDocumentUrl', 'sheetReadyToSend', 'costumeIndications', 'excludeFromTrombinoscope', 'trombinoscopeFaceHidden', 'trombinoscopeNote', 'trombinoscopeDisplayName', 'balanceValue', 'published'],
    remapped: ['trombinoscopePhotoUrl'],
    relinked: ['factions', 'intrigues', 'documents', 'targetedDocuments', 'items', 'locatedItems', 'timelineEvents', 'trombinoscopeViewerEntries', 'trombinoscopeTargetEntries', 'relationsFrom', 'relationsTo', 'questionLinks'],
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
    relinked: ['characters', 'intrigues', 'timelineEvents', 'documents', 'questionLinks'],
    omitted: ['id', 'slug', 'gameId', 'createdAt', 'updatedAt', 'game']
  },
  Intrigue: {
    copied: ['name', 'pitch', 'description', 'level', 'published'],
    remapped: [],
    relinked: ['characters', 'factions', 'items', 'timelineEvents', 'questionLinks'],
    omitted: ['id', 'slug', 'gameId', 'createdAt', 'updatedAt', 'game']
  },
  // Relations entre personnages (US-097, ADR-0050)
  CharacterRelation: {
    copied: ['type', 'description', 'fromLabel', 'fromVisible', 'toLabel', 'toVisible'],
    remapped: ['fromCharacterId', 'toCharacterId'],
    relinked: ['fromCharacter', 'toCharacter'],
    omitted: ['id', 'gameId', 'game', 'createdAt', 'updatedAt']
  },
  // Liens du questionnaire (US-098, ADR-0050) : la question garde son identifiant dans la version copiée
  RegistrationQuestionLink: {
    copied: ['questionId', 'option'],
    remapped: ['characterId', 'factionId', 'intrigueId'],
    relinked: ['character', 'faction', 'intrigue'],
    omitted: ['id', 'gameId', 'game']
  },
  // Proportions attendues (US-141, ADR-0062) : comme les liens, la question garde son identifiant
  RegistrationOptionExpectation: {
    copied: ['questionId', 'option', 'share'],
    remapped: [],
    relinked: [],
    omitted: ['id', 'gameId', 'game', 'updatedAt']
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
    copied: ['title', 'content', 'documentUrl', 'audience', 'audiences', 'readyToSend', 'published'],
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
    omitted: ['id', 'formId', 'number', 'createdAt', 'registrations', 'requests']
  }
} as const satisfies Record<string, { copied: readonly string[], remapped: readonly string[], relinked: readonly string[], omitted: readonly string[] }>

type CopiedModel = keyof typeof GAME_COPY_FIELDS

// Les seuls champs copiés tels quels de la ligne, avec leur type ; la liste de chaque modèle est contrôlée par un test
type CopiedFields<M extends CopiedModel> = typeof GAME_COPY_FIELDS[M]['copied'][number]

function pickCopied<M extends CopiedModel, R extends Record<CopiedFields<M>, unknown>>(model: M, row: R): Pick<R, CopiedFields<M>> {
  return Object.fromEntries(GAME_COPY_FIELDS[model].copied.map((field) => [field, row[field as CopiedFields<M>]])) as Pick<R, CopiedFields<M>>
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
      registrationForm: { include: { versions: { orderBy: { number: 'desc' }, take: 1 } } },
      characterRelations: { orderBy: { createdAt: 'asc' } },
      registrationQuestionLinks: true,
      registrationOptionExpectations: true
    }
  })
  if (!game) {
    throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  }
  return game
}

/**
 * Duplique les photos téléversées sous un nouveau nom (R6). Seuls les fichiers du jeu source hors sessions
 * sont repris : ni la photo d'un joueur (R5), ni le fichier d'un autre jeu. Un fichier écarté ou absent du
 * disque n'est pas repris : le personnage arrive sans photo.
 */
async function duplicatePhotos(sourceGameId: string, urls: Array<string | null>) {
  const copies = new Map<string, string | null>()
  const uploads = [...new Set(urls)].filter((url): url is string => Boolean(url) && isUploadUrl(url!, PHOTO_UPLOAD_PREFIX))
  const owned = new Set((await prisma.uploadedFile.findMany({
    where: { url: { in: uploads }, gameId: sourceGameId, sessionId: null },
    select: { url: true }
  })).map((file) => file.url))
  for (const url of uploads) {
    if (!owned.has(url)) {
      copies.set(url, null)
      continue
    }
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
  // Un slug pris entre leur calcul et la transaction (élément créé, autre copie simultanée) : on recalcule
  for (let attempt = 1; ; attempt++) {
    try {
      return await copyGameOnce(sourceGameId, options)
    } catch (error) {
      if (!isSlugConflict(error) || attempt === 3) throw error
    }
  }
}

const isSlugConflict = (error: unknown) => (error as { slugConflict?: boolean })?.slugConflict === true

async function copyGameOnce(sourceGameId: string, options: GameCopyOptions) {
  const source = await loadSourceGame(sourceGameId)

  const [[gameSlug], characterSlugs, factionSlugs, intrigueSlugs, itemSlugs, eventSlugs, documentSlugs, locationSlugs] = await Promise.all([
    generateUniqueSlugs('game', [source.title]),
    generateUniqueSlugs('character', source.characters.map((row) => row.name)),
    generateUniqueSlugs('faction', source.factions.map((row) => row.name)),
    generateUniqueSlugs('intrigue', source.intrigues.map((row) => row.name)),
    generateUniqueSlugs('item', source.items.map((row) => row.name)),
    generateUniqueSlugs('timelineEvent', source.timelineEvents.map((row) => row.name)),
    generateUniqueSlugs('document', source.documents.map((row) => row.title)),
    generateUniqueSlugs('location', source.locations.map((row) => row.name))
  ])

  const photoCopies = await duplicatePhotos(source.id, source.characters.map((row) => row.trombinoscopePhotoUrl))
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
      // Un lien vers un élément créé pendant la lecture du jeu source (modification concurrente) est ignoré
      const connect = (rows: Array<{ id: string }>) => ({
        connect: rows.flatMap((row) => (newIds.has(row.id) ? [{ id: newIds.get(row.id)! }] : []))
      })

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
        data: source.characters.flatMap((row) => row.trombinoscopeViewerEntries.filter((entry) => newIds.has(entry.targetCharacterId)).map((entry) => ({
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

      if (source.characterRelations.length) {
        await tx.characterRelation.createMany({
          data: source.characterRelations.map((row) => ({
            ...pickCopied('CharacterRelation', row),
            gameId,
            fromCharacterId: newIds.get(row.fromCharacterId)!,
            toCharacterId: newIds.get(row.toCharacterId)!
          }))
        })
      }
      if (source.registrationQuestionLinks.length) {
        await tx.registrationQuestionLink.createMany({
          data: source.registrationQuestionLinks.map((row) => ({
            ...pickCopied('RegistrationQuestionLink', row),
            gameId,
            characterId: mapped(row.characterId),
            factionId: mapped(row.factionId),
            intrigueId: mapped(row.intrigueId)
          }))
        })
      }
      if (source.registrationOptionExpectations.length) {
        await tx.registrationOptionExpectation.createMany({
          data: source.registrationOptionExpectations.map((row) => ({ ...pickCopied('RegistrationOptionExpectation', row), gameId }))
        })
      }

      const currentVersion = source.registrationForm?.versions[0]
      if (currentVersion) {
        await tx.registrationForm.create({
          // La définition, colonne JSON obligatoire, se relit typée JsonValue (null compris) : elle repart telle quelle
          data: { gameId, versions: { create: { ...pickCopied('RegistrationFormVersion', currentVersion), definition: currentVersion.definition as Prisma.InputJsonValue, number: 1 } } }
        })
      }

      const duplicated = [...photoCopies.values()].filter((url): url is string => Boolean(url))
      if (duplicated.length) {
        await tx.uploadedFile.createMany({
          data: duplicated.map((url) => ({
            kind: 'sessionAssignmentPhoto',
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
    // Un élément créé pendant le legs a pris l'un des slugs réservés : rien n'a été copié, on peut recommencer
    if ((error as { code?: string })?.code === 'P2002') {
      throw Object.assign(createError({ statusCode: 409, message: 'Le jeu a été modifié pendant le legs : rien n’a été copié, recommencez.' }), { slugConflict: true })
    }
    throw error
  }
}

/**
 * Supprime une copie léguée encore en attente (invitation expirée ou annulée, R8), avec ses fichiers.
 * La condition sur bequestPending protège une copie déjà attribuée entre-temps.
 */
export async function deletePendingCopy(gameId: string) {
  const uploadUrls = await collectUploadUrls({ gameId })
  const { count } = await prisma.game.deleteMany({ where: { id: gameId, bequestPending: true } })
  if (count) await deleteUnusedUploads(uploadUrls)
  return count > 0
}
