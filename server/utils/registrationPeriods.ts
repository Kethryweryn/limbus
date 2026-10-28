import { randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { CHARACTER_TYPES } from '~/utils/domain'
import { effectivePeriodState } from '~/utils/registrationPeriods'

export const registrationPeriodInclude = {
  sessions: {
    orderBy: { session: { date: 'asc' } },
    include: {
      session: { select: { id: true, name: true, slug: true, date: true, status: true } }
    }
  }
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

  const defaultSeats = requested.some((session) => session.seats == null)
    ? await countPlayableCharacters(gameId)
    : 0

  return requested.map((session) => ({
    sessionId: session.sessionId,
    seats: session.seats ?? defaultSeats
  }))
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

// Retirer d'une période une session qui a des inscriptions les laisserait hors de toute période
export async function assertNoRegistrationsOnRemovedSessions(periodId: string, keptSessionIds: string[]) {
  const orphaned = await prisma.registration.findMany({
    where: { periodId, sessionId: { notIn: keptSessionIds } },
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
