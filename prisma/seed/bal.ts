// Le Bal des Masques Brisés, jeu de test « après et imprévus » : session terminée, annulée et reportée, remboursements,
// photos et legs (US-154, ADR-0066)
import { documentContentHash } from '../../server/utils/deliveryHashes'
import { BEQUEST_INVITATION_DAYS, GAME_INVITATION_KINDS, GAME_INVITATION_STATUSES, REFUND_STATUSES, SESSION_ROLES, SESSION_STATUSES } from '../../utils/domain'
import type { Db, StageContext } from './db'
import { daysFromNow } from './options'

export const BAL_EXTRA_PEOPLE = [
  { name: 'Lucie Moreau', email: 'lucie.moreau@example.test', phone: '06 11 22 33 02' }
]

export async function createBalStage(db: Db, context: StageContext) {
  const { gameId, title, ownerId, locationId, characters, people, makeSlug, address } = context
  const person = (email: string) => people.get(`${email}@example.test`)!
  const session = (name: string, slug: string, days: number, status: string, team: string[], extra: { cancelledAt?: Date, postponedToSessionId?: string } = {}) => db.session.create({
    data: {
      name: `${title} - ${name}`,
      slug: makeSlug(`${title}-${slug}`),
      date: daysFromNow(days),
      gameId,
      locationId,
      status,
      published: true,
      // Annuler ou reporter une session garde son équipe
      participants: { create: team.map((email) => ({ participantId: person(email).id, role: SESSION_ROLES.participant })) },
      ...extra
    },
    select: { id: true, name: true }
  })
  const paid = (sessionId: string, email: string, refund: { refundStatus: string, refundedAt?: Date, carriedOverToSessionId?: string }) =>
    db.sessionPayment.create({
      data: { sessionId, participantId: person(email).id, paidAt: daysFromNow(-40), ...refund }
    })

  // Session terminée : Lucie y retrouve ce qui lui a été envoyé. La copie s'efface après la session (ADR-0044) :
  // elle lit donc la version actuelle du document.
  const archive = await db.session.findFirstOrThrow({ where: { gameId, status: SESSION_STATUSES.completed }, select: { id: true, name: true } })
  const lucie = person('lucie.moreau')
  await db.sessionParticipant.create({ data: { sessionId: archive.id, participantId: lucie.id, role: SESSION_ROLES.participant } })
  const roadmap = await db.document.findFirstOrThrow({
    where: { gameId, title: { startsWith: 'Feuille de route' } },
    select: { id: true, title: true, content: true, documentUrl: true }
  })
  await db.sessionDocumentDelivery.create({
    data: {
      sessionId: archive.id,
      participantId: lucie.id,
      documentId: roadmap.id,
      kind: 'document',
      contentHash: documentContentHash({ name: archive.name, game: { title } }, roadmap),
      sentAt: daysFromNow(-65)
    }
  })

  // Une personne a refusé sa photo : elle n'a pas de rôle, donc aucune photo à retirer
  await db.participant.update({ where: { id: person('jeanne.giraud').id }, data: { photoRefusedAt: daysFromNow(-2) } })

  // Annulée : un paiement à rembourser, un autre déjà remboursé
  const cancelled = await session('Session annulée', 'session-annulee', 20, SESSION_STATUSES.cancelled, ['pauline.aubert', 'maxime.henry'], { cancelledAt: daysFromNow(-1) })
  await paid(cancelled.id, 'pauline.aubert', { refundStatus: REFUND_STATUSES.toRefund })
  await paid(cancelled.id, 'maxime.henry', { refundStatus: REFUND_STATUSES.refunded, refundedAt: daysFromNow(-1) })

  // Reportée : un paiement passe sur la nouvelle session, un autre reste à rembourser
  const replacement = await session('Session de remplacement', 'session-de-remplacement', 90, SESSION_STATUSES.scheduled, ['chloe.renard', 'arthur.masson'])
  const postponed = await session('Session reportée', 'session-reportee', 30, SESSION_STATUSES.postponed, ['chloe.renard', 'arthur.masson'], { postponedToSessionId: replacement.id })
  await paid(postponed.id, 'chloe.renard', { refundStatus: REFUND_STATUSES.carriedOver, carriedOverToSessionId: replacement.id })
  await paid(postponed.id, 'arthur.masson', { refundStatus: REFUND_STATUSES.toRefund })

  // Legs en attente pour Manon, sans compte. Aucun lien n'existe encore : renvoyer l'invitation depuis l'application en crée un.
  if (!ownerId) return
  // Une copie acceptée lors d'un essai précédent garde son adresse de page
  const baseSlug = makeSlug(`${title}-copie-leguee`)
  const takenSlugs = new Set((await db.game.findMany({ where: { slug: { startsWith: baseSlug } }, select: { slug: true } })).map((row) => row.slug))
  let copySlug = baseSlug
  for (let suffix = 2; takenSlugs.has(copySlug); suffix++) copySlug = `${baseSlug}-${suffix}`

  // Quelques éléments, pour que le jeu reçu ne soit pas vide. L'adresse de la copie les distingue d'un rechargement à l'autre.
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { name: true } })
  const copy = await db.game.create({
    data: {
      title: `${title} (copie léguée)`,
      slug: copySlug,
      description: 'Une soirée mondaine où chaque invité cache une dette, une trahison ou une identité empruntée.',
      published: false,
      bequestPending: true,
      copiedFromGameId: gameId,
      creditSourceTitle: title,
      creditAuthorName: owner.name,
      characters: {
        create: characters
          .filter((row) => row.type === 'pj')
          .slice(0, 3)
          .map((row) => ({ name: row.name, slug: makeSlug(`${copySlug}-${row.name}`), type: row.type, pitch: 'Personnage repris du jeu d’origine.' }))
      },
      documents: {
        create: { title: 'Feuille de route', slug: makeSlug(`${copySlug}-feuille-de-route`), content: 'Document repris du jeu d’origine.' }
      }
    },
    select: { id: true }
  })
  await db.gameInvitation.create({
    data: {
      gameId: copy.id,
      email: address('manon.richard@example.test'),
      status: GAME_INVITATION_STATUSES.pending,
      kind: GAME_INVITATION_KINDS.bequest,
      invitedById: ownerId,
      expiresAt: daysFromNow(BEQUEST_INVITATION_DAYS)
    }
  })
}
