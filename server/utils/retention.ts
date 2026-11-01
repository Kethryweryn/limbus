import { prisma } from '~/server/utils/prisma'
import { deleteOwnAccount } from '~/server/utils/accountDeletion'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { sendEmail } from '~/server/utils/email'
import { eraseParticipant } from '~/server/utils/participantPrivacy'
import { USER_ROLES } from '~/utils/domain'
import { RETENTION } from '~/utils/legal'

// Durées de conservation (US-112, US-113, SPEC-013 L6, ADR-0056) : comptes inactifs et fiches sans compte

const DAY_MS = 24 * 60 * 60 * 1000
// Délai minimal entre l'avertissement et l'effacement : la personne a le temps de se connecter
const WARNING_NOTICE_DAYS = 25
const PARTICIPANTS_PER_RUN = 50

function monthsBefore(now: Date, months: number) {
  const date = new Date(now)
  date.setUTCMonth(date.getUTCMonth() - months)
  return date
}

async function warnInactiveAccounts(now: Date) {
  const users = await prisma.user.findMany({
    where: { lastSeenAt: { lt: monthsBefore(now, RETENTION.inactiveAccountWarningMonths) }, inactivityWarnedAt: null, emailConfirmedAt: { not: null }, disabledAt: null },
    select: { id: true, email: true, name: true },
    take: PARTICIPANTS_PER_RUN
  })
  for (const user of users) {
    const sent = await sendEmail({
      to: user.email,
      subject: 'Votre compte Limbus sera effacé dans un mois',
      text: [
        `Bonjour ${user.name},`,
        '',
        `Vous ne vous êtes pas connecté·e à Limbus depuis ${RETENTION.inactiveAccountWarningMonths} mois. Comme l’annonce la politique de confidentialité, un compte inutilisé est effacé après ${RETENTION.inactiveAccountMonths} mois, avec les fiches participant qui lui sont rattachées.`,
        '',
        'Pour garder votre compte, il suffit de vous connecter :',
        absoluteAppUrl('/'),
        '',
        'Vous pouvez aussi, avant, télécharger vos données depuis la page « Mon compte ».'
      ].join('\n')
    }).catch(() => ({ sent: false }))
    // Sans email parti, pas d'avertissement noté : le compte ne sera pas effacé sans avoir été prévenu
    if (sent.sent) await prisma.user.update({ where: { id: user.id }, data: { inactivityWarnedAt: now } })
  }
}

async function deleteInactiveAccounts(now: Date) {
  const users = await prisma.user.findMany({
    where: {
      lastSeenAt: { lt: monthsBefore(now, RETENTION.inactiveAccountMonths) },
      inactivityWarnedAt: { not: null, lt: new Date(now.getTime() - WARNING_NOTICE_DAYS * DAY_MS) },
      inactivityReportedAt: null
    },
    select: { id: true, email: true, name: true },
    take: PARTICIPANTS_PER_RUN
  })
  const kept: Array<{ email: string, name: string, reason: string }> = []
  for (const user of users) {
    try {
      await deleteOwnAccount(user.id)
    } catch (error) {
      // Jeux possédés ou dernière administratrice : le compte reste, l'administratrice est prévenue une fois
      kept.push({ ...user, reason: (error as { message?: string })?.message || 'refus' })
      await prisma.user.update({ where: { id: user.id }, data: { inactivityReportedAt: now } })
    }
  }
  if (!kept.length) return
  const admins = await prisma.user.findMany({ where: { role: USER_ROLES.admin, disabledAt: null }, select: { email: true } })
  for (const admin of admins) {
    await sendEmail({
      to: admin.email,
      subject: 'Comptes Limbus inactifs à traiter',
      text: [
        `Ces comptes n’ont pas servi depuis ${RETENTION.inactiveAccountMonths} mois, mais n’ont pas pu être effacés :`,
        '',
        ...kept.map((user) => `- ${user.name} (${user.email}) : ${user.reason}`),
        '',
        'Transférez ou supprimez leurs jeux, ou nommez une autre administratrice, puis effacez-les depuis l’administration.'
      ].join('\n')
    }).catch(() => undefined)
  }
}

async function eraseStaleParticipants(now: Date) {
  const cutoff = monthsBefore(now, RETENTION.participantWithoutAccountYears * 12)
  const recentSession = { OR: [{ date: { gte: cutoff } }, { date: null, createdAt: { gte: cutoff } }] }
  const stale = await prisma.participant.findMany({
    where: {
      userId: null,
      updatedAt: { lt: cutoff },
      NOT: {
        OR: [
          { gameLinks: { some: { createdAt: { gte: cutoff } } } },
          { registrations: { some: { updatedAt: { gte: cutoff } } } },
          { sessionRoles: { some: { session: recentSession } } },
          { assignments: { some: { session: recentSession } } }
        ]
      }
    },
    select: { id: true },
    take: PARTICIPANTS_PER_RUN
  })
  for (const { id } of stale) await eraseParticipant(id)
  return stale.length
}

/** Lancée après une connexion réussie, sans être attendue ; une erreur est journalisée, jamais renvoyée. */
export async function purgeRetention(now = new Date()) {
  await warnInactiveAccounts(now)
  await deleteInactiveAccounts(now)
  return await eraseStaleParticipants(now)
}
