import type { PrismaClient } from '~/generated/prisma/client'

// Vivier de test (SPEC-018) : un jeu, ses personnages PJ (les places), ses sessions ouvertes, et des personnes
const DAY = 24 * 60 * 60 * 1000
let counter = 0

export type Pool = Awaited<ReturnType<typeof createPool>>

export async function createPool(prisma: PrismaClient, ownerId: string, options: {
  key?: string
  sessions?: number
  // Personnages PJ : le nombre de places de chaque session (R8)
  seats?: number
  // Réglages de sélection de chaque session
  selection?: { selectionMode?: string, organizerPicks?: number, waitlistSize?: number, weightBalance?: boolean, weightNotDrawnBefore?: boolean }
  replayPolicy?: string
  state?: string
  open?: boolean
  game?: Record<string, unknown>
} = {}) {
  const key = `${options.key ?? 'vivier'}-${++counter}-${Math.random().toString(36).slice(2, 8)}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId, ...options.game } })
  if (options.seats) {
    await prisma.character.createMany({
      data: Array.from({ length: options.seats }, (_, index) => ({ name: `PJ ${index + 1}`, slug: `pj-${index + 1}-${key}`, gameId: game.id, type: 'pj' }))
    })
  }
  const sessions = await Promise.all(Array.from({ length: options.sessions ?? 2 }, (_, index) => prisma.session.create({
    data: { name: `Session ${index + 1} ${key}`, slug: `session-${index + 1}-${key}`, gameId: game.id, date: new Date(Date.now() + (10 + index) * DAY) }
  })))
  const period = await prisma.registrationPeriod.create({
    data: {
      gameId: game.id,
      publicId: key,
      state: options.state ?? 'open',
      replayPolicy: options.replayPolicy ?? 'allowed',
      sessions: { create: sessions.map((session) => ({ sessionId: session.id, open: options.open ?? true, ...options.selection })) }
    }
  })
  return { key, game, sessions, period }
}

// Une personne du vivier ; `sessionIds` : les sessions où elle s'est dite disponible (pré-inscrite)
export async function addPerson(prisma: PrismaClient, pool: { game: { id: string }, period: { id: string } }, name: string, sessionIds: string[] = [], extra: Record<string, unknown> = {}) {
  const suffix = `${name.toLowerCase()}-${++counter}-${Math.random().toString(36).slice(2, 8)}`
  const email = `${suffix}@example.test`
  const participant = await prisma.participant.create({
    data: { name, slug: suffix, email, gameLinks: { create: { gameId: pool.game.id } } }
  })
  return await prisma.registration.create({
    data: {
      periodId: pool.period.id,
      participantId: participant.id,
      status: 'received',
      source: 'form',
      email,
      respondedAt: new Date(),
      charterAcceptedAt: new Date(),
      // Remplaçable par `extra`, pour un test qui connaît son jeton
      links: { create: { tokenHash: `hash-${suffix}` } },
      sessionLines: { create: sessionIds.map((sessionId) => ({ sessionId, status: 'preregistered', answer: 'available', answeredAt: new Date() })) },
      ...extra
    }
  })
}

export function lineOf(prisma: PrismaClient, registrationId: string, sessionId: string) {
  return prisma.registrationSession.findUnique({ where: { registrationId_sessionId: { registrationId, sessionId } } })
}
