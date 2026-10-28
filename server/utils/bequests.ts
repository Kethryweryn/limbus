import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { deletePendingCopy } from '~/server/utils/gameCopy'
import { GAME_INVITATION_KINDS, GAME_INVITATION_STATUSES } from '~/utils/domain'

// Validité d'une invitation de legs, comme celle d'une invitation de co-organisation (R8)
export const BEQUEST_INVITATION_DAYS = 14

export function bequestExpiresAt(from = Date.now()) {
  return new Date(from + BEQUEST_INVITATION_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Léguer et suivre ses legs sont réservés à la propriétaire, même en mode administrateur (R1) :
 * le crédit porte son nom, et les invitations sont envoyées en son nom.
 */
export async function requireBequestOwner(event: H3Event, gameId: string) {
  const { user } = await requireGameOwner(event, gameId)
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { ownerId: true, title: true } })
  if (!game || game.ownerId !== user.id) {
    throw createError({ statusCode: 403, message: 'Seule la propriétaire du jeu peut gérer ses legs' })
  }
  return { user, game }
}

/**
 * Supprime les copies en attente du jeu source qui ne peuvent plus être attribuées : invitation expirée,
 * ou aucune invitation en cours. Pas de tâche planifiée : appelé à la lecture et à la création d'un legs (ADR-0020).
 */
export async function purgeExpiredBequests(sourceGameId: string) {
  const stale = await prisma.game.findMany({
    where: {
      copiedFromGameId: sourceGameId,
      bequestPending: true,
      invitations: {
        none: {
          kind: GAME_INVITATION_KINDS.bequest,
          status: GAME_INVITATION_STATUSES.pending,
          expiresAt: { gte: new Date() }
        }
      }
    },
    select: { id: true }
  })
  for (const copy of stale) {
    await deletePendingCopy(copy.id)
  }
  return stale.length
}

// Invitation d'un legs en attente de ce jeu source, sinon 404
export async function findPendingBequest(sourceGameId: string, invitationId: string) {
  const invitation = await prisma.gameInvitation.findFirst({
    where: {
      id: invitationId,
      kind: GAME_INVITATION_KINDS.bequest,
      status: GAME_INVITATION_STATUSES.pending,
      game: { copiedFromGameId: sourceGameId, bequestPending: true }
    },
    select: { id: true, gameId: true, email: true, token: true }
  })
  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Legs en attente introuvable' })
  }
  return invitation
}
