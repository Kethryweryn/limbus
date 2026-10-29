import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { sendGameTransferEmail } from '~/server/utils/email'
import { proposeGameTransfer } from '~/server/utils/gameTransfers'
import { gameTransferSchema, readZodBody } from '~/server/utils/schemas'
import { requireRouterParam } from '~/server/utils/routeParams'

// La propriétaire propose son jeu à une co-organisatrice (US-060), qui est prévenue par email (US-068)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = requireRouterParam(event, 'id')
  const body = await readZodBody(event, gameTransferSchema)
  const result = await proposeGameTransfer(id, user.id, body.userId)

  const [game, recipient] = await Promise.all([
    prisma.game.findUniqueOrThrow({ where: { id }, select: { title: true, slug: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: body.userId }, select: { email: true } })
  ])
  // Un échec d'envoi n'annule pas la proposition : la fiche et la liste des jeux la montrent aussi
  const sent = await sendGameTransferEmail({
    to: recipient.email,
    gameTitle: game.title,
    ownerName: user.name || user.email,
    url: absoluteAppUrl(`/games/${game.slug}`)
  }).then((outcome) => outcome.sent, () => false)
  return { ...result, emailSent: sent }
})
