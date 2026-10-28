import { randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { CHARACTER_TYPES, REGISTRATION_PERIOD_STATES, REGISTRATION_STATUSES, SESSION_STATUSES } from '~/utils/domain'
import { effectivePeriodState } from '~/utils/registrationPeriods'

export const registrationPeriodInclude = {
  sessions: {
    orderBy: { session: { date: 'asc' } },
    include: {
      session: { select: { id: true, name: true, slug: true, date: true, status: true } }
    }
  }
} as const

// Inscriptions telles que la liste des organisatrices les montre, sans les réponses au formulaire (US-005 les détaillera)
export const registrationListSelect = {
  id: true,
  sessionId: true,
  status: true,
  source: true,
  email: true,
  invitationSentAt: true,
  responseDueAt: true,
  respondedAt: true,
  confirmedAt: true,
  withdrawnAt: true,
  createdAt: true,
  participant: { select: { id: true, name: true, slug: true } },
  invitedBy: { select: { name: true } },
  withdrawnBy: { select: { name: true } }
} as const

// Identifiant court du lien de diffusion (R32) : aléatoire, pour ne pas permettre de deviner les autres périodes
export function createRegistrationPeriodPublicId() {
  return randomBytes(6).toString('base64url')
}

export function exposeRegistrationPeriod<T extends { state: string, closesAt: Date | null }>(period: T) {
  return { ...period, effectiveState: effectivePeriodState(period) }
}

export async function countPlayableCharacters(gameId: string) {
  return await prisma.character.count({ where: { gameId, type: CHARACTER_TYPES.pj } })
}

/**
 * Vérifie les sessions demandées pour une période d'inscription et complète les places :
 * - chaque session appartient au jeu de la période ;
 * - aucune n'est déjà rattachée à une autre période (R1) ;
 * - sans nombre de places, on prend le nombre de personnages PJ du jeu (R5).
 */
export async function resolveRegistrationPeriodSessions(
  gameId: string,
  requested: Array<{ sessionId: string, seats?: number | null }>,
  periodId?: string
) {
  const sessionIds = requested.map((session) => session.sessionId)
  const sessions = await prisma.session.findMany({
    where: { id: { in: sessionIds }, gameId },
    select: {
      id: true,
      name: true,
      status: true,
      registrationPeriodLink: { select: { periodId: true, period: { select: { name: true } } } }
    }
  })

  if (sessions.length !== sessionIds.length) {
    throw createError({ statusCode: 400, message: 'Session invalide pour ce jeu' })
  }

  const taken = sessions.filter((session) =>
    session.registrationPeriodLink && session.registrationPeriodLink.periodId !== periodId
  )
  if (taken.length) {
    const names = taken.map((session) => `« ${session.name} » (période « ${session.registrationPeriodLink!.period.name} »)`)
    throw createError({
      statusCode: 409,
      message: `Une session ne peut appartenir qu’à une seule période d’inscription : ${names.join(', ')}`
    })
  }

  // On ne recrute pas pour une session annulée ou terminée ; une session déjà rattachée peut le rester
  const finished = sessions.filter((session) => {
    const alreadyInPeriod = Boolean(periodId) && session.registrationPeriodLink?.periodId === periodId
    return !alreadyInPeriod && ([SESSION_STATUSES.cancelled, SESSION_STATUSES.completed] as string[]).includes(session.status)
  })
  if (finished.length) {
    throw createError({
      statusCode: 400,
      message: `Une session annulée ou terminée ne peut pas être ajoutée : ${finished.map((session) => `« ${session.name} »`).join(', ')}`
    })
  }

  const defaultSeats = requested.some((session) => session.seats == null)
    ? await countPlayableCharacters(gameId)
    : 0

  return requested.map((session) => ({
    sessionId: session.sessionId,
    seats: session.seats ?? defaultSeats
  }))
}

// Une période ouverte dont la date de clôture est passée resterait clôturée (ADR-0020) : on le dit plutôt
// que d'enregistrer un état qui ne s'appliquerait pas
export function assertClosingDateAllowsState(state: string, closesAt: Date | null, now = new Date()) {
  if (state === REGISTRATION_PERIOD_STATES.open && closesAt && closesAt.getTime() <= now.getTime()) {
    throw createError({ statusCode: 400, message: 'La date de clôture est passée : retirez-la ou choisissez une date future pour ouvrir la période.' })
  }
}

// publicId est aléatoire (48 bits) : une collision, très improbable, se règle en tirant un autre identifiant
export async function withFreshPublicId<T>(create: (publicId: string) => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await create(createRegistrationPeriodPublicId())
    } catch (error) {
      const { code, meta } = (error || {}) as { code?: string, meta?: unknown }
      const collision = code === 'P2002' && JSON.stringify(meta ?? {}).includes('publicId')
      if (!collision || attempt >= attempts) throw error
    }
  }
}

// Deux enregistrements simultanés peuvent passer la vérification ci-dessus : l'unicité de
// RegistrationPeriodSession.sessionId tranche, et on renvoie le même refus qu'à la vérification.
export function rethrowSessionAlreadyTaken(error: unknown): never {
  const { code, meta } = (error || {}) as { code?: string, meta?: unknown }
  if (code === 'P2002' && JSON.stringify(meta ?? {}).includes('sessionId')) {
    throw createError({ statusCode: 409, message: 'Une session ne peut appartenir qu’à une seule période d’inscription' })
  }
  throw error
}

// Retirer d'une période une session qui a des inscriptions en cours les laisserait hors de toute période ;
// des inscriptions déclinées ou désistées n'empêchent pas de la retirer
export async function assertNoRegistrationsOnRemovedSessions(periodId: string, keptSessionIds: string[]) {
  const orphaned = await prisma.registration.findMany({
    where: { periodId, sessionId: { notIn: keptSessionIds }, status: { not: REGISTRATION_STATUSES.withdrawn } },
    distinct: ['sessionId'],
    select: { session: { select: { name: true } } }
  })
  const names = orphaned.map((registration) => registration.session?.name).filter(Boolean)
  if (names.length) {
    throw createError({
      statusCode: 409,
      message: `Une session qui a des inscriptions ne peut pas être retirée de la période : ${names.map((name) => `« ${name} »`).join(', ')}`
    })
  }
}

export function parseOptionalDate(value?: string | null) {
  return value ? new Date(value) : null
}

export async function findRegistrationPeriodOr404(id: string | undefined) {
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const period = await prisma.registrationPeriod.findUnique({ where: { id }, select: { id: true, gameId: true } })
  if (!period) {
    throw createError({ statusCode: 404, message: 'Période d’inscription introuvable' })
  }
  return period
}
