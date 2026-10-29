import { prisma } from '~/server/utils/prisma'
import { sendEmail } from '~/server/utils/email'
import { deletePendingCopy } from '~/server/utils/gameCopy'
import { eraseParticipant, exportParticipantData } from '~/server/utils/participantPrivacy'
import { myParticipantIds } from '~/server/utils/participantAccounts'
import { storageUsage } from '~/server/utils/uploads'
import { GAME_INVITATION_KINDS, GAME_INVITATION_STATUSES, REGISTRATION_STATUSES, USER_ROLES } from '~/utils/domain'

// Export et effacement depuis le compte (US-076, US-077, ADR-0043)

// Tout ce que Limbus garde sur la personne : son compte et ses fiches, dans tous les jeux
export async function exportAccountData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,
      emailConfirmedAt: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      dietary: true,
      healthConsentAt: true,
      profileUpdatedAt: true,
      storageQuotaMb: true,
      ownedGames: { select: { title: true } },
      gameShares: { select: { createdAt: true, game: { select: { title: true } } } }
    }
  })
  const { ownedGames, gameShares, storageQuotaMb, ...account } = user
  const participantIds = await myParticipantIds(userId)
  return {
    exportedAt: new Date().toISOString(),
    account: { ...account, storage: await storageUsage({ id: userId, storageQuotaMb }) },
    ownedGames: ownedGames.map((game) => game.title),
    sharedGames: gameShares.map((share) => ({ title: share.game.title, since: share.createdAt })),
    // Ses propres données : sans limite de jeux, notes des équipes comprises
    participantRecords: await Promise.all(participantIds.map((id) => exportParticipantData(id, null)))
  }
}

const formatEuros = (cents: number) => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const formatDate = (value: Date) => value.toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

/**
 * Ce que chaque équipe doit savoir avant que les données disparaissent : par jeu, les sessions où la
 * personne avait une place et les paiements reçus, avec les adresses de la propriétaire et des co-organisatrices.
 */
async function teamNotices(participantIds: string[]) {
  const inMine = { participantId: { in: participantIds } }
  const [links, roles, registrations, payments] = await Promise.all([
    prisma.participantGame.findMany({
      where: inMine,
      select: { game: { select: { id: true, title: true, owner: { select: { email: true } }, shares: { select: { user: { select: { email: true } } } } } } }
    }),
    prisma.sessionParticipant.findMany({ where: inMine, select: { session: { select: { gameId: true, name: true } } } }),
    prisma.registration.findMany({
      where: { ...inMine, status: { not: REGISTRATION_STATUSES.withdrawn }, sessionId: { not: null } },
      select: { session: { select: { gameId: true, name: true } } }
    }),
    prisma.sessionPayment.findMany({
      where: inMine,
      select: { paidAt: true, instalments: { select: { amountCents: true } }, session: { select: { gameId: true, name: true } } }
    })
  ])

  const games = new Map<string, { title: string, recipients: Set<string>, sessions: Set<string>, payments: string[] }>()
  for (const { game } of links) {
    const recipients = new Set([game.owner?.email, ...game.shares.map((share) => share.user.email)].filter((email): email is string => Boolean(email)))
    games.set(game.id, { title: game.title, recipients, sessions: new Set(), payments: [] })
  }
  for (const item of [...roles, ...registrations]) {
    if (item.session) games.get(item.session.gameId)?.sessions.add(item.session.name)
  }
  for (const payment of payments) {
    const received = payment.instalments.reduce((total, instalment) => total + instalment.amountCents, 0)
    const line = received
      ? `${payment.session.name} : ${formatEuros(received)} reçus`
      : payment.paidAt ? `${payment.session.name} : paiement noté le ${formatDate(payment.paidAt)}` : null
    if (line) games.get(payment.session.gameId)?.payments.push(line)
  }
  return [...games.values()].filter((game) => game.recipients.size)
}

export function accountDeletionEmailText(personName: string, game: { title: string, sessions: Set<string>, payments: string[] }) {
  return [
    `${personName} a effacé son compte Limbus. Comme demandé, sa fiche et toutes ses données ont été effacées du jeu « ${game.title} » : inscriptions, coordonnées, photos, paiements et vos notes.`,
    '',
    game.sessions.size
      ? `Ses places sont libérées dans : ${[...game.sessions].join(', ')}.`
      : 'Aucune place à libérer dans vos sessions.',
    ...(game.payments.length
      ? ['', 'Paiements reçus, à rembourser ou à régler à la main (ils ne figurent plus dans Limbus) :', ...game.payments.map((line) => `- ${line}`)]
      : [])
  ].join('\n')
}

/**
 * Effacement demandé par la personne (US-077, ADR-0043) : refusé tant qu'elle possède un jeu, ou si elle est
 * la dernière administratrice active. Ce qu'on dira aux équipes est relevé avant l'effacement, et l'email ne part
 * qu'une fois tout effacé ; un échec d'envoi n'annule pas l'effacement.
 */
export async function deleteOwnAccount(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, role: true } })
  if (await prisma.game.count({ where: { ownerId: userId } })) {
    throw createError({ statusCode: 409, message: 'Vous possédez encore des jeux : transférez-les à une co-organisatrice ou supprimez-les avant d’effacer votre compte.' })
  }
  if (user.role === USER_ROLES.admin && !await prisma.user.count({ where: { role: USER_ROLES.admin, disabledAt: null, id: { not: userId } } })) {
    throw createError({ statusCode: 409, message: 'Vous êtes la dernière administratrice : nommez-en une autre avant d’effacer votre compte.' })
  }

  const participantIds = await myParticipantIds(userId)
  const notices = participantIds.length ? await teamNotices(participantIds) : []

  for (const participantId of participantIds) {
    await eraseParticipant(participantId)
  }
  // Copies léguées en attente qu'elle avait envoyées : sans elle, ni propriétaire ni invitation (ADR-0043)
  const pendingBequests = await prisma.gameInvitation.findMany({
    where: { invitedById: userId, kind: GAME_INVITATION_KINDS.bequest, status: GAME_INVITATION_STATUSES.pending, game: { bequestPending: true } },
    select: { gameId: true }
  })
  for (const { gameId } of pendingBequests) {
    await deletePendingCopy(gameId)
  }
  // Revérifié au dernier moment : un transfert accepté entre-temps laisserait un jeu sans propriétaire
  await prisma.$transaction(async (tx) => {
    if (await tx.game.count({ where: { ownerId: userId } })) {
      throw createError({ statusCode: 409, message: 'Vous possédez désormais un jeu : transférez-le ou supprimez-le avant d’effacer votre compte.' })
    }
    await tx.user.delete({ where: { id: userId } })
  }, { isolationLevel: 'Serializable' })

  let emailsSent = 0
  for (const game of notices) {
    const sent = await sendEmail({
      to: [...game.recipients],
      subject: `${user.name} a effacé ses données : ${game.title}`,
      text: accountDeletionEmailText(user.name, game)
    }).then((outcome) => outcome.sent, () => false)
    if (sent) emailsSent += 1
  }
  return { erasedParticipants: participantIds.length, teamsNotified: emailsSent, teams: notices.length }
}
