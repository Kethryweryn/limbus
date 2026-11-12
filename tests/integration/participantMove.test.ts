// US-239 (SPEC-022 R7, ADR-0086) : une équipe corrige l'adresse d'une fiche ; seuls ses jeux changent de fiche
import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { isParticipantSlug } from '~/utils/participantSlug'

const world = inject('world')
const { alice, bob } = world.users
const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

type Saved = { id: string, slug: string, name: string, email: string, games: Array<{ id: string }>, gameNotes: Record<string, string | null> }

// Une fiche suivie par Alice (un jeu, une session où elle joue, une inscription) et, au besoin, par Bob
async function sharedFiche(withBob = true) {
  const key = `deplacement-${++counter}`
  const aliceGame = await prisma.game.create({ data: { title: `Alice ${key}`, slug: `alice-${key}`, description: '', ownerId: alice.id } })
  const bobGame = await prisma.game.create({ data: { title: `Bob ${key}`, slug: `bob-${key}`, description: '', ownerId: bob.id } })
  const fiche = await prisma.participant.create({
    data: {
      name: `Paul ${key}`,
      slug: `p-${key}`.slice(0, 40),
      email: `paul-${key}@example.test`,
      gameLinks: {
        create: [
          { gameId: aliceGame.id, name: `Paul chez Alice ${key}`, notes: 'Note d’Alice' },
          ...(withBob ? [{ gameId: bobGame.id, name: `Paul chez Bob ${key}`, notes: 'Note de Bob' }] : [])
        ]
      }
    }
  })
  const session = await prisma.session.create({ data: { slug: `session-${key}`, gameId: aliceGame.id } })
  const character = await prisma.character.create({ data: { name: `Rôle ${key}`, slug: `role-${key}`, gameId: aliceGame.id } })
  await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: fiche.id, role: 'participant' } })
  await prisma.sessionAssignment.create({ data: { gameId: aliceGame.id, sessionId: session.id, characterId: character.id, participantId: fiche.id } })
  const period = await prisma.registrationPeriod.create({ data: { gameId: aliceGame.id, publicId: `periode-${key}` } })
  await prisma.registration.create({ data: { gameId: aliceGame.id, periodId: period.id, participantId: fiche.id, status: 'received', source: 'invitation', email: fiche.email! } })
  // Paiement, présence et responsabilité du déroulé : à déplacer aussi
  await prisma.sessionPayment.create({ data: { gameId: aliceGame.id, sessionId: session.id, participantId: fiche.id, paidAt: new Date() } })
  await prisma.sessionAttendance.create({ data: { sessionId: session.id, participantId: fiche.id, responseDueAt: new Date(Date.now() + 86_400_000) } })
  const event = await prisma.timelineEvent.create({ data: { name: `Ouverture ${key}`, slug: `ouverture-${key}`, day: 1, time: '10:00', gameId: aliceGame.id } })
  await prisma.timelineEventResponsible.create({ data: { gameId: aliceGame.id, sessionId: session.id, timelineEventId: event.id, participantId: fiche.id } })
  return { key, aliceGame, bobGame, fiche, session, period }
}

const correct = async (id: string, game: { id: string }, email: string, name = 'Paul corrigé') =>
  await api(alice, 'PUT', `/api/participants/${id}`, { name, email, gameIds: [game.id] })

describe('corriger l’adresse d’une fiche (US-239, SPEC-022 R7)', () => {
  it('sur une fiche commune : seuls les jeux de l’équipe passent à une nouvelle fiche, l’autre équipe garde la sienne', async () => {
    const { key, aliceGame, bobGame, fiche, session, period } = await sharedFiche()
    const response = await correct(fiche.id, aliceGame, `paul-corrige-${key}@example.test`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const saved = response.body as Saved
    expect(saved.id).not.toBe(fiche.id)
    expect(isParticipantSlug(saved.slug)).toBe(true)
    expect(saved).toMatchObject({ email: `paul-corrige-${key}@example.test`, name: 'Paul corrigé', gameNotes: { [aliceGame.id]: 'Note d’Alice' } })
    expect(saved.games.map((game) => game.id)).toEqual([aliceGame.id])
    // Tout ce qu'Alice tient l'a suivie
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: saved.id } })).toBe(1)
    expect(await prisma.sessionAssignment.count({ where: { sessionId: session.id, participantId: saved.id } })).toBe(1)
    expect(await prisma.registration.findFirstOrThrow({ where: { periodId: period.id, participantId: saved.id }, select: { email: true } }))
      .toEqual({ email: `paul-corrige-${key}@example.test` })
    expect(await prisma.sessionPayment.count({ where: { sessionId: session.id, participantId: saved.id } })).toBe(1)
    expect(await prisma.sessionAttendance.count({ where: { sessionId: session.id, participantId: saved.id } })).toBe(1)
    expect(await prisma.timelineEventResponsible.count({ where: { sessionId: session.id, participantId: saved.id } })).toBe(1)
    expect(await prisma.sessionPayment.count({ where: { participantId: fiche.id } })).toBe(0)
    // Bob garde la fiche d'origine, son adresse, son nom et sa note
    const original = await prisma.participant.findUniqueOrThrow({ where: { id: fiche.id }, select: { name: true, email: true, gameLinks: { select: { gameId: true, name: true, notes: true } } } })
    expect(original).toEqual({ name: fiche.name, email: fiche.email, gameLinks: [{ gameId: bobGame.id, name: `Paul chez Bob ${key}`, notes: 'Note de Bob' }] })
    expect(JSON.stringify(saved)).not.toMatch(/chez Bob|Note de Bob/)
  })

  it('vers l’adresse d’une fiche d’une autre équipe : les jeux la rejoignent, sans rien en montrer, et la fiche vide disparaît', async () => {
    const { key, aliceGame, fiche } = await sharedFiche(false)
    const bobsGame = await prisma.game.create({ data: { title: `Autre Bob ${key}`, slug: `autre-bob-${key}`, description: '', ownerId: bob.id } })
    const bobs = await prisma.participant.create({ data: { name: 'Chez Bob', slug: `p-bob-${key}`.slice(0, 40), email: `bob-${key}@example.test`, gameLinks: { create: { gameId: bobsGame.id, name: 'Nom chez Bob', notes: 'Note de Bob' } } } })
    const response = await correct(fiche.id, aliceGame, bobs.email!)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const saved = response.body as Saved
    expect(saved).toMatchObject({ id: bobs.id, name: 'Paul corrigé' })
    expect(saved.games.map((game) => game.id)).toEqual([aliceGame.id])
    expect(JSON.stringify(saved)).not.toMatch(/Nom chez Bob|Note de Bob/)
    expect(await prisma.participant.findUnique({ where: { id: fiche.id } })).toBeNull()
    // Bob ne voit que son jeu, avec son nom
    const bobRead = (await api(bob, 'GET', `/api/participants/${bobs.id}`)).body as Saved
    expect(bobRead).toMatchObject({ name: 'Nom chez Bob' })
    expect(bobRead.games.map((game) => game.id)).toEqual([bobsGame.id])
  })

  it('sur une fiche que l’équipe est seule à suivre, vers une adresse libre : l’adresse change sur place', async () => {
    const { key, aliceGame, fiche } = await sharedFiche(false)
    const response = await correct(fiche.id, aliceGame, `paul-nouveau-${key}@example.test`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ id: fiche.id, slug: fiche.slug, email: `paul-nouveau-${key}@example.test` })
  })

  it('deux fiches de la même équipe réunies : notes bout à bout, la ligne la plus récente reste', async () => {
    const { key, aliceGame, fiche, period, session } = await sharedFiche(false)
    const twin = await prisma.participant.create({ data: { name: 'Doublon', slug: `p-twin-${key}`.slice(0, 40), email: `twin-${key}@example.test`, gameLinks: { create: { gameId: aliceGame.id, name: 'Doublon', notes: 'Note du doublon' } } } })
    const newer = await prisma.registration.create({ data: { gameId: aliceGame.id, periodId: period.id, participantId: twin.id, status: 'received', source: 'form', email: twin.email! } })
    // Paiement du doublon, plus ancien que celui de la fiche corrigée : c'est celui de la fiche corrigée qui reste
    const older = await prisma.sessionPayment.create({ data: { gameId: aliceGame.id, sessionId: session.id, participantId: twin.id } })
    await prisma.sessionPayment.update({ where: { id: older.id }, data: { updatedAt: new Date(Date.now() - 86_400_000) } })
    await prisma.sessionPayment.updateMany({ where: { sessionId: session.id, participantId: fiche.id }, data: { paymentEmailSentAt: new Date() } })
    const response = await correct(fiche.id, aliceGame, twin.email!)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect((response.body as Saved).gameNotes[aliceGame.id]).toBe('Note du doublon\n\nNote d’Alice')
    expect((await prisma.registration.findMany({ where: { periodId: period.id }, select: { id: true } })).map((row) => row.id)).toEqual([newer.id])
    const payments = await prisma.sessionPayment.findMany({ where: { sessionId: session.id }, select: { participantId: true, paymentEmailSentAt: true } })
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ participantId: twin.id })
    expect(payments[0]!.paymentEmailSentAt).not.toBeNull()
  })
})

describe('fonction de déplacement', () => {
  it('porte chaque table qui désigne une fiche participant', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8')
    const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
      .filter(([, , body]) => /^\s+\w+\s+Participant\??\s+@relation/m.test(body!))
      .map(([, name]) => name!)
    const move = readFileSync('prisma/migrations/20261202090000_deplacer_une_fiche/migration.sql', 'utf8')
    // Une demande de preuve d'adresse (US-243) reste à la fiche qui l'a faite, et part avec elle : rien à déplacer
    const notMoved = new Set(['ParticipantEmailProof'])
    expect(models.length).toBeGreaterThan(5)
    expect(models.filter((model) => !notMoved.has(model) && !move.includes(`"${model}"`))).toEqual([])
  })
})
