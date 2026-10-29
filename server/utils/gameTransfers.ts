import { prisma } from '~/server/utils/prisma'

// Transfert d'un jeu à une co-organisatrice (US-060, ADR-0038)

// Seule la propriétaire propose, même en mode administrateur, comme pour un legs (SPEC-002, R1)
async function requireOwnGame(gameId: string, userId: string) {
  const game = await prisma.game.findFirst({ where: { id: gameId, ownerId: userId, bequestPending: false }, select: { id: true } })
  if (!game) {
    throw createError({ statusCode: 403, message: 'Seule la propriétaire du jeu peut proposer son transfert' })
  }
}

export async function proposeGameTransfer(gameId: string, ownerId: string, userId: string) {
  await requireOwnGame(gameId, ownerId)
  // Une seule requête : la destinataire doit être co-organisatrice au moment même de l'écriture
  const { count } = await prisma.game.updateMany({
    where: { id: gameId, ownerId, shares: { some: { userId } } },
    data: { transferToUserId: userId }
  })
  if (!count) {
    throw createError({ statusCode: 400, message: 'Le jeu ne se transfère qu’à l’une de ses co-organisatrices' })
  }
  return { id: gameId, transferToUserId: userId }
}

// Retirer la proposition (la propriétaire) ou la refuser (la destinataire)
export async function cancelGameTransfer(gameId: string, userId: string) {
  const { count } = await prisma.game.updateMany({
    where: { id: gameId, transferToUserId: { not: null }, OR: [{ ownerId: userId }, { transferToUserId: userId }] },
    data: { transferToUserId: null }
  })
  if (!count) {
    throw createError({ statusCode: 404, message: 'Aucun transfert en cours pour ce jeu' })
  }
}

// La destinataire devient propriétaire ; l'ancienne propriétaire devient co-organisatrice
export async function acceptGameTransfer(gameId: string, userId: string) {
  return await prisma.$transaction(async (tx) => {
    const game = await tx.game.findFirst({
      where: { id: gameId, transferToUserId: userId, bequestPending: false, shares: { some: { userId } } },
      select: { id: true, ownerId: true }
    })
    if (!game) {
      throw createError({ statusCode: 404, message: 'Aucun transfert ne vous est proposé pour ce jeu' })
    }

    await tx.gameShare.delete({ where: { gameId_userId: { gameId, userId } } })
    if (game.ownerId) {
      await tx.gameShare.upsert({
        where: { gameId_userId: { gameId, userId: game.ownerId } },
        create: { gameId, userId: game.ownerId },
        update: {}
      })
    }
    return await tx.game.update({ where: { id: gameId }, data: { ownerId: userId, transferToUserId: null }, select: { id: true, slug: true, ownerId: true } })
  })
}
