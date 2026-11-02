// EPIC-030 : comptes inactifs (US-112) et fiches sans compte (US-113)
import bcrypt from 'bcrypt'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp } from './smtp'

const prisma = createTestPrisma()
const { alice } = inject('world').users
const DAY = 86_400_000
const MONTH = 30.5 * DAY
let counter = 0
let smtp: Awaited<ReturnType<typeof startTestSmtp>>

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

const ago = (ms: number) => new Date(Date.now() - ms)
const unique = (key: string) => `${key}-${++counter}-${Date.now()}@example.test`

// La purge passe après une connexion réussie, sans être attendue
async function loginSomeone() {
  const email = unique('connexion')
  await prisma.user.create({ data: { email, name: 'Connexion', password: await bcrypt.hash('mot-de-passe-solide', 4) } })
  expect((await api(null, 'POST', '/api/auth/login', { email, password: 'mot-de-passe-solide' })).status).toBe(200)
}

const user = (key: string, data: Record<string, unknown>) => prisma.user.create({ data: { email: unique(key), name: key, password: 'non-utilise', ...data } })

describe('comptes inactifs (US-112)', () => {
  it('avertit à 23 mois, efface à 24 mois après l’avertissement, et garde un compte jamais averti', async () => {
    const toWarn = await user('a-avertir', { lastSeenAt: ago(23.5 * MONTH) })
    const toDelete = await user('a-effacer', { lastSeenAt: ago(25 * MONTH), inactivityWarnedAt: ago(30 * DAY) })
    const neverWarned = await user('jamais-averti', { lastSeenAt: ago(25 * MONTH) })
    // Un compte désactivé suit la même durée
    const disabled = await user('desactive', { lastSeenAt: ago(23.5 * MONTH), disabledAt: ago(MONTH) })
    await loginSomeone()
    await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: disabled.id } })).inactivityWarnedAt).not.toBeNull()

    await expect.poll(async () => (await prisma.user.findUnique({ where: { id: toDelete.id } }))).toBeNull()
    await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: toWarn.id } })).inactivityWarnedAt).not.toBeNull()
    expect(smtp.received.some((email) => email.to.includes(toWarn.email) && email.text.includes('Pour garder votre compte'))).toBe(true)
    // Jamais averti : averti maintenant, pas effacé
    await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: neverWarned.id } })).inactivityWarnedAt).not.toBeNull()
  })

  it('une activité annule l’avertissement', async () => {
    const back = await user('de-retour', { lastSeenAt: ago(23.5 * MONTH), inactivityWarnedAt: ago(2 * DAY) })
    expect((await api(back, 'GET', '/api/auth/me')).status).toBe(200)
    await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: back.id } })).inactivityWarnedAt).toBeNull()
    expect((await prisma.user.findUniqueOrThrow({ where: { id: back.id } })).lastSeenAt.getTime()).toBeGreaterThan(Date.now() - DAY)
  })

  it('garde un compte qui possède encore des jeux, et le signale une fois à l’administratrice', async () => {
    const owner = await user('proprietaire', { lastSeenAt: ago(25 * MONTH), inactivityWarnedAt: ago(30 * DAY) })
    await prisma.game.create({ data: { title: 'Jeu gardé', slug: `jeu-garde-${counter}`, description: '', ownerId: owner.id } })
    await loginSomeone()
    await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).inactivityReportedAt).not.toBeNull()
    expect(smtp.received.some((email) => email.text.includes(owner.email) && email.text.includes('n’ont pas pu être avertis ou effacés'))).toBe(true)
  })
})

describe('fiches sans compte (US-113)', () => {
  async function participant(key: string, data: Record<string, unknown> = {}, linkedAt = ago(4 * 12 * MONTH)) {
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-retention-${key}-${++counter}`, description: '', ownerId: alice.id } })
    return await prisma.participant.create({
      data: { name: key, slug: `retention-${key}-${counter}`, updatedAt: ago(4 * 12 * MONTH), gameLinks: { create: { gameId: game.id, createdAt: linkedAt } }, ...data }
    })
  }

  it('efface une fiche sans activité depuis trois ans, garde les autres', async () => {
    const stale = await participant('ancienne')
    const recentLink = await participant('ajout-recent', {}, ago(DAY))
    const account = await user('titulaire', {})
    const withAccount = await participant('avec-compte', { userId: account.id })
    const withSession = await participant('session-recente')
    const session = await prisma.session.create({ data: { name: `Session ${counter}`, slug: `session-retention-${counter}`, gameId: (await prisma.participantGame.findFirstOrThrow({ where: { participantId: withSession.id } })).gameId, date: ago(30 * DAY) } })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: withSession.id, role: 'participant' } })
    await prisma.participant.update({ where: { id: withSession.id }, data: { updatedAt: ago(4 * 12 * MONTH) } })

    await loginSomeone()
    await expect.poll(async () => await prisma.participant.findUnique({ where: { id: stale.id } })).toBeNull()
    for (const kept of [recentLink, withAccount, withSession]) {
      expect(await prisma.participant.findUnique({ where: { id: kept.id } })).not.toBeNull()
    }
  })
})
