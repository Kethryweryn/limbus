import { prisma } from '~/server/utils/prisma'
import { notActivatedAccount } from '~/server/utils/participantAccounts'
import { deleteOwnAccount } from '~/server/utils/accountDeletion'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { openEmailTransport, sendEmail } from '~/server/utils/email'
import { eraseParticipant } from '~/server/utils/participantPrivacy'
import { USER_ROLES } from '~/utils/domain'
import { RETENTION } from '~/utils/legal'
import { purgeEmailProofs } from '~/server/utils/emailProofs'

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
  // Comptes désactivés compris : la durée vaut pour eux aussi. Un compte signalé (avertissement impossible) sort de la file
  const users = await prisma.user.findMany({
    where: { lastSeenAt: { lt: monthsBefore(now, RETENTION.inactiveAccountWarningMonths) }, inactivityWarnedAt: null, inactivityReportedAt: null, emailConfirmedAt: { not: null } },
    select: { id: true, email: true, name: true },
    orderBy: { lastSeenAt: 'asc' },
    take: PARTICIPANTS_PER_RUN
  })
  if (!users.length) return []
  // Un seul transport pour tout le lot ; sans SMTP, personne n'est averti, donc personne n'est effacé
  const transport = await openEmailTransport().catch(() => null)
  if (!transport) return []
  const unreachable: Array<{ email: string, name: string, reason: string }> = []
  try {
    await sendWarnings(transport, users, now, unreachable)
  } finally {
    transport.close()
  }
  return unreachable
}

async function sendWarnings(
  transport: NonNullable<Awaited<ReturnType<typeof openEmailTransport>>>,
  users: Array<{ id: string, email: string, name: string }>,
  now: Date,
  unreachable: Array<{ email: string, name: string, reason: string }>
) {
  for (const user of users) {
    const sent = await transport.send({
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
    }).then(() => true, () => false)
    // Sans email parti, pas d'avertissement noté : le compte n'est pas effacé sans avoir été prévenu. Il est signalé à
    // l'administratrice, et ne bloque pas les suivants
    if (sent) {
      await prisma.user.updateMany({ where: { id: user.id }, data: { inactivityWarnedAt: now } })
    } else {
      unreachable.push({ ...user, reason: 'l’email d’avertissement n’a pas pu partir' })
      await prisma.user.updateMany({ where: { id: user.id }, data: { inactivityReportedAt: now } })
    }
  }
}

async function deleteInactiveAccounts(now: Date, kept: Array<{ email: string, name: string, reason: string }>) {
  const users = await prisma.user.findMany({
    where: {
      lastSeenAt: { lt: monthsBefore(now, RETENTION.inactiveAccountMonths) },
      inactivityWarnedAt: { not: null, lt: new Date(now.getTime() - WARNING_NOTICE_DAYS * DAY_MS) },
      inactivityReportedAt: null
    },
    select: { id: true, email: true, name: true },
    take: PARTICIPANTS_PER_RUN
  })
  for (const user of users) {
    try {
      await deleteOwnAccount(user.id)
    } catch (error) {
      // Jeux possédés ou dernière administratrice : le compte reste, l'administratrice est prévenue une fois
      kept.push({ ...user, reason: (error as { message?: string })?.message || 'refus' })
      await prisma.user.updateMany({ where: { id: user.id }, data: { inactivityReportedAt: now } })
    }
  }
  if (!kept.length) return
  const admins = await prisma.user.findMany({ where: { role: USER_ROLES.admin, disabledAt: null }, select: { email: true } })
  for (const admin of admins) {
    await sendEmail({
      to: admin.email,
      subject: 'Comptes Limbus inactifs à traiter',
      text: [
        'Ces comptes sont inactifs depuis longtemps, mais n’ont pas pu être avertis ou effacés :',
        '',
        ...kept.map((user) => `- ${user.name} (${user.email}) : ${user.reason}`),
        '',
        'Selon le cas : transférez ou supprimez leurs jeux, nommez une autre administratrice, ou vérifiez l’envoi des emails, puis effacez-les depuis l’administration.'
      ].join('\n')
    }).catch(() => undefined)
  }
}

async function eraseStaleParticipants(now: Date) {
  const cutoff = monthsBefore(now, RETENTION.participantWithoutAccountYears * 12)
  const recentSession = { OR: [{ date: { gte: cutoff } }, { date: null, createdAt: { gte: cutoff } }] }
  const stale = await prisma.participant.findMany({
    where: {
      // Sans compte, ou avec un compte jamais activé (ADR-0088) : la personne n'a jamais rien tenu
      OR: [{ userId: null }, { user: notActivatedAccount }],
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

let running: Promise<number> | null = null
let rerun = false

async function purgeOnce(now: Date) {
  // Liens de preuve d'adresse expirés (US-243, ADR-0087)
  await purgeEmailProofs(now)
  const kept = await warnInactiveAccounts(now)
  await deleteInactiveAccounts(now, kept)
  return await eraseStaleParticipants(now)
}

/**
 * Lancée après une connexion réussie, sans être attendue ; une erreur est journalisée, jamais renvoyée. Une seule à la
 * fois : deux connexions rapprochées ne traitent pas deux fois les mêmes comptes. Une demande faite pendant un
 * passage en relance un juste après, pour ne rien laisser de côté.
 */
export function purgeRetention(now = new Date()) {
  if (running) {
    rerun = true
    return running
  }
  running = (async () => {
    let erased = await purgeOnce(now)
    while (rerun) {
      rerun = false
      erased += await purgeOnce(new Date())
    }
    return erased
  })().finally(() => {
    running = null
  })
  return running
}
