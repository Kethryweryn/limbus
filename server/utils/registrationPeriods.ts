import type { Prisma } from '~/generated/prisma/client'
import { labelNestedSessions, labelSessions } from '~/server/utils/sessionLabels'
import { randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { CHARACTER_TYPES, REGISTRATION_SEAT_STATUSES } from '~/utils/domain'
import { openableSessionWhere } from '~/utils/registrationPeriods'
import { absoluteAppUrl } from '~/server/utils/appUrl'

// Le vivier d'un jeu (SPEC-018, ADR-0069). Le code garde le nom des tables, « period » ; l'interface dit « vivier »

export const registrationPeriodInclude = {
  sessions: {
    orderBy: { session: { date: 'asc' } },
    include: {
      session: { select: { id: true, slug: true, date: true, status: true } }
    }
  }
} as const

// Personnes du vivier telles que la liste des organisatrices les montre, sans les réponses au formulaire
// (détail : GET /api/registrations/:id)
export const registrationListSelect = {
  id: true,
  // Jeu de l'inscription : le nom de la personne est celui qu'en tient l'équipe de ce jeu (ADR-0086)
  gameId: true,
  status: true,
  source: true,
  email: true,
  invitedSessionId: true,
  invitationSentAt: true,
  lastRemindedAt: true,
  responseDueAt: true,
  respondedAt: true,
  withdrawnAt: true,
  createdAt: true,
  // Statut par session (R17)
  sessionLines: {
    select: {
      sessionId: true,
      status: true,
      answer: true,
      waitlistPosition: true,
      responseDueAt: true,
      lastRemindedAt: true,
      confirmedAt: true,
      cancelledAt: true,
      announcedStatus: true,
      announcedAt: true,
      ignoredStatus: true,
      cancelledById: true,
      answersChangedAt: true
    }
  },
  participant: { select: { id: true, slug: true } },
  invitedBy: { select: { name: true } },
  withdrawnBy: { select: { name: true } }
} as const satisfies Prisma.RegistrationSelect

// Identifiant court du lien de diffusion (R32) : aléatoire, pour ne pas permettre de deviner les autres viviers
export function createRegistrationPeriodPublicId() {
  return randomBytes(6).toString('base64url')
}

// diffusionUrl : le lien de diffusion à copier (R32), par absoluteAppUrl, jamais d'après la requête
// Ses sessions avec leur libellé, calculé (SPEC-021)
export async function exposeRegistrationPeriod<T extends { state: string, publicId: string }>(period: T) {
  return { ...await labelNestedSessions(prisma, period), diffusionUrl: absoluteAppUrl(`/i/${period.publicId}`) }
}

// Le nombre de places d'une session (R8) : jamais stocké, pour l'augmenter on crée un personnage
export async function countPlayableCharacters(gameId: string) {
  return await prisma.character.count({ where: { gameId, type: CHARACTER_TYPES.pj } })
}

// Places prises dans des sessions (R8) : les personnes retenues ou inscrites
export function takenSeatsWhere(sessionIds: string[]) {
  return {
    sessionId: { in: sessionIds },
    status: { in: REGISTRATION_SEAT_STATUSES }
  }
}

// Sessions que le vivier propose (R6) : ouvertes par l'équipe, et encore datées, à venir, ni annulées ni terminées
export async function offeredSessions(periodId: string, now = new Date()) {
  const links = await prisma.registrationPeriodSession.findMany({
    where: { periodId, open: true, session: openableSessionWhere(now) },
    orderBy: { session: { date: 'asc' } },
    select: { session: { select: { id: true, date: true, status: true, location: { select: { name: true, address: true } } } } }
  })
  // Avec leur libellé, calculé (SPEC-021)
  return await labelSessions(prisma, links.map((link) => link.session))
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

// Deux créations simultanées passent la vérification : l'unicité de gameId tranche, avec le même refus (R1)
export function rethrowPoolAlreadyExists(error: unknown): never {
  const { code, meta } = (error || {}) as { code?: string, meta?: unknown }
  if (code === 'P2002' && JSON.stringify(meta ?? {}).includes('gameId')) {
    throw createError({ statusCode: 409, message: 'Ce jeu a déjà un vivier.' })
  }
  throw error
}

export async function findRegistrationPeriodOr404(id: string | undefined) {
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const period = await prisma.registrationPeriod.findUnique({ where: { id }, select: { id: true, gameId: true } })
  if (!period) {
    throw createError({ statusCode: 404, message: 'Vivier introuvable' })
  }
  return period
}
