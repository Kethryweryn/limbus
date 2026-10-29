import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { deletePendingCopy } from '~/server/utils/gameCopy'
import { sendGameBequestInvitationEmail } from '~/server/utils/email'
import { GAME_INVITATION_KINDS, GAME_INVITATION_STATUSES } from '~/utils/domain'

// Validité d'une invitation de legs, comme celle d'une invitation de co-organisation (R8)
const BEQUEST_INVITATION_DAYS = 14
// Une copie sans invitation est peut-être en train d'être léguée (copie faite, invitation pas encore créée) :
// on ne la considère abandonnée qu'après ce délai
const ORPHAN_COPY_GRACE_MS = 60 * 60 * 1000

export function bequestExpiresAt(from = Date.now()) {
  return new Date(from + BEQUEST_INVITATION_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Léguer et suivre ses legs sont réservés à la propriétaire, même en mode administrateur (R1) :
 * le crédit porte son nom, et les invitations sont envoyées en son nom.
 */
export async function requireBequestOwner(event: H3Event, gameId: string) {
  const user = await requireUser(event)
  const game = await prisma.game.findFirst({ where: { id: gameId, ownerId: user.id, bequestPending: false }, select: { title: true } })
  if (!game) {
    throw createError({ statusCode: 403, message: 'Seule la propriétaire du jeu peut gérer ses legs' })
  }
  return { user, game }
}

/**
 * Supprime les copies en attente du jeu source qui ne peuvent plus être attribuées : invitation expirée,
 * ou aucune invitation en cours. Pas de tâche planifiée : appelé à la lecture et à la création d'un legs (ADR-0020).
 * Une copie qui n'a encore aucune invitation n'est supprimée qu'après ORPHAN_COPY_GRACE_MS : son legs est peut-être en cours.
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
      },
      OR: [
        { invitations: { some: {} } },
        { createdAt: { lt: new Date(Date.now() - ORPHAN_COPY_GRACE_MS) } }
      ]
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
    select: { id: true, gameId: true, email: true }
  })
  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Legs en attente introuvable' })
  }
  return invitation
}

/**
 * Envoie l'invitation d'un legs sans compte. Sans email parti, la destinataire n'a aucun moyen de recevoir la copie :
 * 502, et l'appelant n'enregistre rien (`consequence` complète le message).
 */
export async function sendBequestInvitation(params: Parameters<typeof sendGameBequestInvitationEmail>[0], consequence: string) {
  const delivery = await sendGameBequestInvitationEmail(params)
    .catch((error: { message?: string }) => ({ sent: false, reason: error?.message || 'smtp_error' }))
  if (!delivery.sent) {
    const reason = 'reason' in delivery && delivery.reason !== 'smtp_disabled' ? delivery.reason : 'envoi d’emails désactivé'
    throw createError({ statusCode: 502, message: `L’invitation n’a pas pu partir (${reason})${consequence}` })
  }
}
