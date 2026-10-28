import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { gameBequestSchema, readZodBody } from '~/server/utils/schemas'
import { normalizeInvitationEmail } from '~/server/utils/invitations'
import { copyGame } from '~/server/utils/gameCopy'
import { sendGameBequestEmail } from '~/server/utils/email'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

// Lègue une copie du jeu à une autre organisatrice (SPEC-002, US-010)
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
  if (!recipient) {
    throw createError({ statusCode: 400, message: 'Aucun compte Limbus ne correspond à cet email. Le legs à une personne sans compte n’est pas encore possible.' })
  }

  const ownerName = user.name || user.email
  const copy = await copyGame(id, {
    ownerId: recipient.id,
    creditSourceTitle: game.title,
    creditAuthorName: ownerName
  })

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
    emailDelivery
  }
})
