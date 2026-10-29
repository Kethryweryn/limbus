// EPIC-010 : toute écriture rejouée hors ligne porte la version lue, suppressions et sous-routes comprises (US-050, ADR-0036)
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let counter = 0

const NO_VERSION = new Date(0).toISOString()
const since = (date: Date | string) => ({ headers: { 'if-unmodified-since': new Date(date).toISOString() } })
const isConflict = (response: { status: number, body: unknown }) =>
  response.status === 409 && (response.body as { data?: { conflict?: boolean } }).data?.conflict === true

afterAll(async () => {
  await prisma.$disconnect()
})

async function aliceSession() {
  const key = `hors-ligne-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
  const lea = await prisma.participant.create({
    data: { name: `Lea ${key}`, slug: `lea-${key}`, email: `lea-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
  })
  await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: lea.id, role: 'participant' } })
  return { key, game, session, lea }
}

describe('suppression rejouée (US-050)', () => {
  it('est refusée si l’élément a été modifié depuis sa lecture, acceptée avec la version actuelle', async () => {
    const s = await aliceSession()
    const read = await prisma.faction.create({ data: { name: `Groupe ${s.key}`, slug: `groupe-${s.key}`, gameId: s.game.id } })
    const changed = await prisma.faction.update({ where: { id: read.id }, data: { name: `Groupe renommé ${s.key}`, updatedAt: new Date(read.updatedAt.getTime() + 1000) } })

    expect(isConflict(await api(alice, 'DELETE', `/api/factions/${read.id}`, undefined, since(read.updatedAt)))).toBe(true)
    expect(await prisma.faction.findUnique({ where: { id: read.id } })).not.toBeNull()

    expect((await api(alice, 'DELETE', `/api/factions/${read.id}`, undefined, since(changed.updatedAt))).status).toBe(200)
    expect(await prisma.faction.findUnique({ where: { id: read.id } })).toBeNull()
  })
})

describe('paiement d’une personne (US-048, US-050)', () => {
  it('garde la date du clic et refuse une version périmée de la ligne', async () => {
    const s = await aliceSession()
    const clickedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    const url = `/api/sessions/${s.session.id}/payments/${s.lea.id}`

    // Ligne pas encore créée : la version zéro passe
    expect((await api(alice, 'PUT', url, { paid: true, paidAt: clickedAt }, since(NO_VERSION))).status).toBe(200)
    const row = await prisma.sessionPayment.findUniqueOrThrow({ where: { sessionId_participantId: { sessionId: s.session.id, participantId: s.lea.id } } })
    expect(row.paidAt?.toISOString()).toBe(clickedAt)

    // Rejouée sur la version zéro alors que la ligne existe : conflit
    expect(isConflict(await api(alice, 'PUT', url, { paid: false }, since(NO_VERSION)))).toBe(true)
    expect(isConflict(await api(alice, 'PUT', `${url}/offered`, { offered: true }, since(NO_VERSION)))).toBe(true)
    expect((await api(alice, 'PUT', url, { paid: false }, since(row.updatedAt))).status).toBe(200)
  })

  it('refuse une date de paiement dans le futur', async () => {
    const s = await aliceSession()
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}/payments/${s.lea.id}`, { paid: true, paidAt: future })).status).toBe(400)
  })
})

describe('réglages de paiement, tarif et trombinoscope (US-050)', () => {
  it('les réglages ont leur version, sans toucher celle de la session', async () => {
    const s = await aliceSession()
    const url = `/api/sessions/${s.session.id}/payments/settings`
    const first = await api(alice, 'PUT', url, { paymentLinkUrl: 'https://paiement.example.test/1' }, since(NO_VERSION))
    expect(first.status).toBe(200)
    const version = (first.body as { paymentSettingsUpdatedAt: string }).paymentSettingsUpdatedAt
    expect(version).toBeTruthy()

    expect(isConflict(await api(alice, 'PUT', url, { paymentLinkUrl: 'https://paiement.example.test/2' }, since(NO_VERSION)))).toBe(true)
    expect((await api(alice, 'PUT', url, { paymentLinkUrl: 'https://paiement.example.test/2' }, since(version))).status).toBe(200)
    expect((await prisma.session.findUniqueOrThrow({ where: { id: s.session.id } })).updatedAt.getTime()).toBe(s.session.updatedAt.getTime())
  })

  it('un tarif modifié depuis sa lecture est refusé', async () => {
    const s = await aliceSession()
    const read = await prisma.sessionTariff.create({ data: { sessionId: s.session.id, name: 'PJ', amountCents: 5000 } })
    await prisma.sessionTariff.update({ where: { id: read.id }, data: { amountCents: 6000, updatedAt: new Date(read.updatedAt.getTime() + 1000) } })
    const body = { name: 'PJ', amount: 55, defaultRole: null, baseTariffId: null }
    expect(isConflict(await api(alice, 'PUT', `/api/sessions/${s.session.id}/tariffs/${read.id}`, body, since(read.updatedAt)))).toBe(true)
  })

  it('le trombinoscope d’un personnage a pour version sa dernière entrée', async () => {
    const s = await aliceSession()
    const character = (name: string) => prisma.character.create({ data: { name: `${name} ${s.key}`, slug: `${name.toLowerCase()}-${s.key}`, gameId: s.game.id, type: 'pj' } })
    const [aube, brume] = await Promise.all([character('Aube'), character('Brume')])
    const url = `/api/characters/${aube.id}/trombinoscope`
    const body = { entries: [{ targetCharacterId: brume.id, included: true, faceKnown: false }] }

    expect((await api(alice, 'GET', url)).body).toMatchObject({ updatedAt: null })
    expect((await api(alice, 'PUT', url, body, since(NO_VERSION))).status).toBe(200)
    const version = ((await api(alice, 'GET', url)).body as { updatedAt: string }).updatedAt
    expect(version).toBeTruthy()

    expect(isConflict(await api(alice, 'PUT', url, body, since(NO_VERSION)))).toBe(true)
    expect((await api(alice, 'PUT', url, body, since(version))).status).toBe(200)
  })
})
