import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { gameBequestSchema, readZodBody } from '~/server/utils/schemas'
import { createInvitationToken, invitationUrl, normalizeInvitationEmail } from '~/server/utils/invitations'
import { copyGame, deletePendingCopy } from '~/server/utils/gameCopy'
import { sendGameBequestEmail, sendGameBequestInvitationEmail } from '~/server/utils/email'
import { GAME_INVITATION_KINDS } from '~/utils/domain'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

// Validité d'une invitation de legs, comme celle d'une invitation de co-organisation (R8)
const BEQUEST_INVITATION_DAYS = 14

// Lègue une copie du jeu à une autre organisatrice, avec ou sans compte (SPEC-002, US-010, US-011)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const { user } = await requireGameOwner(event, id)
  const game = await prisma.game.findUnique({ where: { id }, select: { ownerId: true, title: true } })
  // Même en mode administrateur, seule la propriétaire lègue (R1) : le crédit porte son nom
  if (!game || game.ownerId !== user.id) {
    throw createError({ statusCode: 403, message: 'Seule la propriétaire du jeu peut le léguer' })
  }

  const body = await readZodBody(event, gameBequestSchema)
  const email = normalizeInvitationEmail(body.email)
  if (email === normalizeInvitationEmail(user.email)) {
    throw createError({ statusCode: 400, message: 'Vous ne pouvez pas vous léguer votre propre jeu : le legs donne une copie à une autre organisatrice.' })
  }
  // Par compte, tous jeux confondus : la réponse dit si l'email a un compte, on limite les essais
  assertRateLimit(event, {
    name: 'game-bequest',
    limit: 10,
    windowMs: 60 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event)]
  })

  const recipient = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } })
  const ownerName = user.name || user.email
  const credit = { creditSourceTitle: game.title, creditAuthorName: ownerName }

  // Sans compte (US-011) : copie faite maintenant (R9) mais en attente, invisible pour tous, et invitation à créer un compte
  if (!recipient) {
    const copy = await copyGame(id, { ...credit, ownerId: null, bequestPending: true })
    const expiresAt = new Date(Date.now() + BEQUEST_INVITATION_DAYS * 24 * 60 * 60 * 1000)
    const invitation = await prisma.gameInvitation.create({
      data: { gameId: copy.id, email, token: createInvitationToken(), kind: GAME_INVITATION_KINDS.bequest, invitedById: user.id, expiresAt },
      select: { token: true }
    })
    // Sans email, la destinataire n'a aucun moyen de recevoir la copie : rien n'est légué
    const delivery = await sendGameBequestInvitationEmail({ to: email, gameTitle: game.title, ownerName, url: invitationUrl(invitation.token), expiresAt })
      .catch((error: { message?: string }) => ({ sent: false, reason: error?.message || 'smtp_error' }))
    if (!delivery.sent) {
      await deletePendingCopy(copy.id)
      const reason = 'reason' in delivery && delivery.reason !== 'smtp_disabled' ? delivery.reason : 'envoi d’emails désactivé'
      throw createError({ statusCode: 502, message: `L’invitation n’a pas pu partir (${reason}) : rien n’a été légué.` })
    }
    return { recipient: { name: null, email }, pending: true, expiresAt, emailDelivery: { sent: true } }
  }

  const copy = await copyGame(id, { ...credit, ownerId: recipient.id })

  let emailDelivery: { sent: boolean, reason?: string }
  try {
    emailDelivery = await sendGameBequestEmail({
      to: recipient.email,
      gameTitle: game.title,
      ownerName,
      url: absoluteAppUrl(`/games/${copy.slug}`)
    })
  } catch (error: any) {
    console.warn('Game bequest email failed', { gameId: id, copyId: copy.id, error: error?.message || 'smtp_error' })
    emailDelivery = { sent: false, reason: error?.statusMessage || error?.message || 'smtp_error' }
  }

  return {
    recipient: { name: recipient.name, email: recipient.email },
    pending: false,
    emailDelivery
  }
})
