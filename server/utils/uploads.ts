import { readFile, stat, unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { prisma } from '~/server/utils/prisma'
import { isUploadUrl, PHOTO_UPLOAD_PREFIX, RIB_UPLOAD_PREFIX } from '~/utils/urls'

export const UPLOAD_DIRS = {
  photos: 'session-assignment-photos',
  ribs: 'session-payment-ribs'
} as const

export function uploadDir(kind: typeof UPLOAD_DIRS[keyof typeof UPLOAD_DIRS]) {
  return join(process.cwd(), '.data', 'uploads', kind)
}

// Chemin sur le disque d'un fichier téléversé, ou null pour une URL externe
export function uploadFilePath(url: string | null | undefined) {
  if (!url) return null
  if (isUploadUrl(url, PHOTO_UPLOAD_PREFIX)) return join(uploadDir(UPLOAD_DIRS.photos), basename(url))
  if (isUploadUrl(url, RIB_UPLOAD_PREFIX)) return join(uploadDir(UPLOAD_DIRS.ribs), basename(url))
  return null
}

/**
 * Les fichiers téléversés qu'un élément référence doivent appartenir à son jeu : sinon une organisatrice
 * pourrait s'approprier le fichier d'un autre jeu en mettant son nom dans une URL (photo, RIB joint aux emails).
 * - sessionFiles : false pour un élément du jeu (photo de personnage), qui ne prend pas la photo d'un joueur
 *   prise pour une session (SPEC-002 R5) ; true pour une session, qui peut reprendre un fichier d'une autre
 *   session du même jeu.
 * - keep : références déjà en place, non revérifiées, pour ne pas bloquer la modification d'anciennes données.
 */
export async function assertGameUploads(
  urls: Array<string | null | undefined>,
  gameId: string,
  options: { sessionFiles: boolean, keep?: Array<string | null | undefined>, label?: string }
) {
  const keep = new Set(options.keep ?? [])
  const candidates = [...new Set(urls)].filter((url): url is string => Boolean(uploadFilePath(url)) && !keep.has(url))
  if (!candidates.length) return
  const owned = await prisma.uploadedFile.count({
    where: {
      url: { in: candidates },
      ...(options.sessionFiles
        ? { OR: [{ gameId }, { session: { gameId } }] }
        : { gameId, sessionId: null })
    }
  })
  if (owned !== candidates.length) {
    throw createError({ statusCode: 400, message: `${options.label ?? 'Fichier'} inconnu pour ce jeu : téléversez le fichier depuis Limbus.` })
  }
}

export async function readUpload(url: string | null | undefined) {
  const path = uploadFilePath(url)
  return path ? await readFile(path) : null
}

/**
 * Supprime (base et disque) les fichiers téléversés qui ne sont plus référencés nulle part :
 * photo d'assignation, photo de personnage, RIB de session. Une même photo peut servir
 * à plusieurs sessions : on ne supprime qu'une fois la dernière référence partie.
 * À appeler après la modification ou la suppression qui a retiré les références.
 */
export async function deleteUnusedUploads(urls: Array<string | null | undefined>) {
  const candidates = [...new Set(urls)].filter((url): url is string => Boolean(uploadFilePath(url)))
  if (!candidates.length) return 0

  const [assignments, characters, sessions] = await Promise.all([
    prisma.sessionAssignment.findMany({ where: { photoUrl: { in: candidates } }, select: { photoUrl: true } }),
    prisma.character.findMany({ where: { trombinoscopePhotoUrl: { in: candidates } }, select: { trombinoscopePhotoUrl: true } }),
    prisma.session.findMany({ where: { paymentRibUrl: { in: candidates } }, select: { paymentRibUrl: true } })
  ])
  const used = new Set<string | null>([
    ...assignments.map((row) => row.photoUrl),
    ...characters.map((row) => row.trombinoscopePhotoUrl),
    ...sessions.map((row) => row.paymentRibUrl)
  ])
  const orphans = candidates.filter((url) => !used.has(url))

  await prisma.uploadedFile.deleteMany({ where: { url: { in: orphans } } })
  for (const url of orphans) {
    await unlink(uploadFilePath(url)!).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }
  return orphans.length
}

// Fichiers d'un ensemble de sessions et de personnages, à relever avant de les supprimer
export async function collectUploadUrls(where: { gameId?: string, sessionId?: string, characterId?: string }) {
  const sessionWhere = where.sessionId ? { id: where.sessionId } : where.gameId ? { gameId: where.gameId } : null
  const assignmentWhere = where.characterId
    ? { characterId: where.characterId }
    : sessionWhere ? { session: sessionWhere } : null

  const [files, assignments, characters, sessions] = await Promise.all([
    where.characterId
      ? []
      : prisma.uploadedFile.findMany({
          where: where.sessionId ? { sessionId: where.sessionId } : { OR: [{ gameId: where.gameId }, { session: { gameId: where.gameId } }] },
          select: { url: true }
        }),
    assignmentWhere ? prisma.sessionAssignment.findMany({ where: assignmentWhere, select: { photoUrl: true } }) : [],
    where.characterId || where.gameId
      ? prisma.character.findMany({ where: where.characterId ? { id: where.characterId } : { gameId: where.gameId }, select: { trombinoscopePhotoUrl: true } })
      : [],
    sessionWhere ? prisma.session.findMany({ where: sessionWhere, select: { paymentRibUrl: true } }) : []
  ])

  return [
    ...files.map((row) => row.url),
    ...assignments.map((row) => row.photoUrl),
    ...characters.map((row) => row.trombinoscopePhotoUrl),
    ...sessions.map((row) => row.paymentRibUrl)
  ]
}

const MB = 1024 * 1024

/**
 * Espace utilisé par un compte (US-066) : les fichiers des jeux qu'il possède, qui que soit la personne
 * qui les a téléversés. Un fichier d'avant US-066 n'a pas de taille : elle est relevée sur le disque et gardée.
 */
export async function storageUsedBytes(userId: string) {
  const ownedGame = { ownerId: userId }
  const [{ _sum }, unsized] = await Promise.all([
    prisma.uploadedFile.aggregate({ where: { size: { not: null }, OR: [{ game: ownedGame }, { session: { game: ownedGame } }] }, _sum: { size: true } }),
    prisma.uploadedFile.findMany({ where: { size: null, OR: [{ game: ownedGame }, { session: { game: ownedGame } }] }, select: { id: true, url: true } })
  ])
  let total = _sum.size ?? 0
  for (const file of unsized) {
    const path = uploadFilePath(file.url)
    const size = path ? await stat(path).then((info) => info.size, () => 0) : 0
    await prisma.uploadedFile.update({ where: { id: file.id }, data: { size } })
    total += size
  }
  return total
}

// Espace utilisé de tous les comptes (page des comptes) : une requête par sorte de rattachement
export async function storageUsedBytesByOwner() {
  await prisma.uploadedFile.findMany({ where: { size: null }, select: { id: true, url: true } }).then(async (unsized) => {
    for (const file of unsized) {
      const path = uploadFilePath(file.url)
      await prisma.uploadedFile.update({ where: { id: file.id }, data: { size: path ? await stat(path).then((info) => info.size, () => 0) : 0 } })
    }
  })
  const files = await prisma.uploadedFile.findMany({
    where: { size: { gt: 0 } },
    select: { size: true, game: { select: { ownerId: true } }, session: { select: { game: { select: { ownerId: true } } } } }
  })
  const totals = new Map<string, number>()
  for (const file of files) {
    const ownerId = file.game?.ownerId ?? file.session?.game.ownerId
    if (ownerId) totals.set(ownerId, (totals.get(ownerId) ?? 0) + (file.size ?? 0))
  }
  return totals
}

export async function storageUsage(user: { id: string, storageQuotaMb: number }) {
  return { usedBytes: await storageUsedBytes(user.id), quotaBytes: user.storageQuotaMb * MB }
}

// Refuse un téléversement qui dépasserait le plafond de la propriétaire du jeu ; une copie léguée en attente n'en a pas
export async function assertStorageQuota(gameId: string, incomingBytes: number) {
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { owner: { select: { id: true, storageQuotaMb: true } } } })
  if (!game?.owner) return
  const { usedBytes, quotaBytes } = await storageUsage(game.owner)
  if (usedBytes + incomingBytes > quotaBytes) {
    const mb = (bytes: number) => Math.ceil(bytes / MB)
    throw createError({
      statusCode: 413,
      message: `L’espace de stockage de la propriétaire du jeu est plein (${mb(usedBytes)} Mo sur ${mb(quotaBytes)} Mo).`
    })
  }
}
