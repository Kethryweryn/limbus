// US-240 (SPEC-022 R8, ADR-0086) : la fusion des fiches d'une même adresse, rejouée sur des doublons préparés. L'index
// unique de l'adresse les interdit désormais : le test le retire dans une transaction, qui est ensuite annulée
import { afterAll, describe, expect, inject, it } from 'vitest'
import { createTestPrisma } from './db'

const world = inject('world')
const { alice, bob } = world.users
const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

class Rollback extends Error {}

// Prépare les doublons, fusionne, lit le résultat, puis annule tout
async function mergedWorld<T>(prepare: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>, read: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], prepared: T, merged: number) => Promise<void>) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('DROP INDEX "Participant_email_key"')
    const prepared = await prepare(tx)
    const [row] = await tx.$queryRaw<Array<{ merged: number }>>`SELECT limbus_merge_duplicate_participants() AS merged`
    await read(tx, prepared, Number(row?.merged ?? 0))
    throw new Rollback()
  }, { timeout: 30_000 }).catch((error) => {
    if (!(error instanceof Rollback)) throw error
  })
}

describe('fusion des fiches d’une même adresse (US-240)', () => {
  it('réunit deux fiches de deux propriétaires dans la plus ancienne, sans rien perdre', async () => {
    const key = `fusion-${++counter}`
    await mergedWorld(async (tx) => {
      const [aliceGame, bobGame] = await Promise.all([alice, bob].map((owner, index) =>
        tx.game.create({ data: { title: `Jeu ${index} ${key}`, slug: `jeu-${index}-${key}`, description: '', ownerId: owner.id } })
      ))
      const oldest = await tx.participant.create({ data: { name: 'Paul A', slug: `p-a-${key}`, email: `paul-${key}@example.test`, createdAt: new Date('2026-01-01'), gameLinks: { create: { gameId: aliceGame!.id, name: 'Paul chez Alice', notes: 'Note d’Alice' } } } })
      const younger = await tx.participant.create({ data: { name: 'Paul B', slug: `p-b-${key}`, email: `PAUL-${key}@Example.test`, photoRefusedAt: new Date(), gameLinks: { create: { gameId: bobGame!.id, name: 'Paul chez Bob', notes: 'Note de Bob' } } } })
      const session = await tx.session.create({ data: { slug: `session-${key}`, gameId: bobGame!.id } })
      await tx.sessionParticipant.create({ data: { sessionId: session.id, participantId: younger.id, role: 'participant' } })
      await tx.sessionPayment.create({ data: { gameId: bobGame!.id, sessionId: session.id, participantId: younger.id } })
      return { aliceGame: aliceGame!, bobGame: bobGame!, oldest, younger, session }
    }, async (tx, { aliceGame, bobGame, oldest, younger, session }, merged) => {
      expect(merged).toBeGreaterThanOrEqual(1)
      expect(await tx.participant.findUnique({ where: { id: younger.id } })).toBeNull()
      const kept = await tx.participant.findUniqueOrThrow({ where: { id: oldest.id }, select: { slug: true, photoRefusedAt: true, gameLinks: { select: { gameId: true, name: true, notes: true }, orderBy: { gameId: 'asc' } } } })
      // L'adresse de page de la plus ancienne, le refus de photo de l'autre
      expect(kept.slug).toBe(oldest.slug)
      expect(kept.photoRefusedAt).not.toBeNull()
      expect(kept.gameLinks).toEqual([
        { gameId: aliceGame.id, name: 'Paul chez Alice', notes: 'Note d’Alice' },
        { gameId: bobGame.id, name: 'Paul chez Bob', notes: 'Note de Bob' }
      ].sort((left, right) => left.gameId.localeCompare(right.gameId)))
      expect(await tx.sessionParticipant.count({ where: { sessionId: session.id, participantId: oldest.id } })).toBe(1)
      expect(await tx.sessionPayment.count({ where: { sessionId: session.id, participantId: oldest.id } })).toBe(1)
    })
  })

  it('deux fiches dans le même jeu : cast et inscription réunis sans doublon, la note garde les deux textes', async () => {
    const key = `fusion-${++counter}`
    await mergedWorld(async (tx) => {
      const game = await tx.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
      const oldest = await tx.participant.create({ data: { name: 'Lou', slug: `p-a-${key}`, email: `lou-${key}@example.test`, createdAt: new Date('2026-01-01'), gameLinks: { create: { gameId: game.id, name: 'Lou', notes: 'Première note' } } } })
      const twin = await tx.participant.create({ data: { name: 'Lou bis', slug: `p-b-${key}`, email: `lou-${key}@example.test`, gameLinks: { create: { gameId: game.id, name: 'Lou bis', notes: 'Seconde note' } } } })
      const session = await tx.session.create({ data: { slug: `session-${key}`, gameId: game.id } })
      await tx.sessionParticipant.createMany({ data: [oldest, twin].map((fiche) => ({ sessionId: session.id, participantId: fiche.id, role: 'participant' as const })) })
      const period = await tx.registrationPeriod.create({ data: { gameId: game.id, publicId: `periode-${key}` } })
      await tx.registration.create({ data: { gameId: game.id, periodId: period.id, participantId: oldest.id, status: 'received', source: 'invitation', email: oldest.email!, updatedAt: new Date('2026-01-02') } })
      const recent = await tx.registration.create({ data: { gameId: game.id, periodId: period.id, participantId: twin.id, status: 'received', source: 'form', email: twin.email! } })
      return { game, oldest, session, period, recent }
    }, async (tx, { game, oldest, session, period, recent }) => {
      expect(await tx.participant.count({ where: { email: oldest.email } })).toBe(1)
      expect((await tx.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: oldest.id, gameId: game.id } } })).notes).toBe('Première note\n\nSeconde note')
      expect(await tx.sessionParticipant.count({ where: { sessionId: session.id } })).toBe(1)
      expect(await tx.registration.findMany({ where: { periodId: period.id }, select: { id: true, participantId: true } })).toEqual([{ id: recent.id, participantId: oldest.id }])
    })
  })

  it('après la fusion, la base refuse une deuxième fiche à la même adresse, sans tenir compte de la casse', async () => {
    const key = `fusion-${++counter}`
    await prisma.participant.create({ data: { name: 'Unique', slug: `p-u-${key}`, email: `unique-${key}@example.test` } })
    await expect(prisma.participant.create({ data: { name: 'Doublon', slug: `p-d-${key}`, email: `UNIQUE-${key}@example.test` } })).rejects.toThrow()
    // Plusieurs fiches sans adresse restent possibles
    await prisma.participant.createMany({ data: [1, 2].map((index) => ({ name: `Sans adresse ${index}`, slug: `p-s${index}-${key}` })) })
  })
})
