// EPIC-028 : information (US-107), durée et purge (US-108), retrait et refus (US-109) des photos des participants
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { triggerPurge } from './purge'

const prisma = createTestPrisma()
const { alice, bob } = inject('world').users
const PHOTOS = join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')
const DAY = 86_400_000
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

const body = (response: { body: unknown }) => response.body as any

async function photo(gameId: string) {
  const filename = `photo-rgpd-${++counter}-${Date.now()}.png`
  await mkdir(PHOTOS, { recursive: true })
  await writeFile(join(PHOTOS, filename), 'x')
  const url = `/api/uploads/session-assignment-photos/${filename}`
  await prisma.uploadedFile.create({ data: { kind: 'session-assignment-photo', filename, url, gameId } })
  return { url, path: join(PHOTOS, filename) }
}

async function aliceGame(extra: Record<string, unknown> = {}) {
  const key = `photos-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id, ...extra } })
  const [viewer, target] = await Promise.all(['Lea', 'Noe'].map((name) => prisma.character.create({ data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, gameId: game.id } })))
  const person = (name: string, data: Record<string, unknown> = {}) => prisma.participant.create({
    data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } }, ...data }
  })
  return { key, game, viewer: viewer!, target: target!, person }
}

async function castSession(g: Awaited<ReturnType<typeof aliceGame>>, date: Date | null, holder: { id: string }, photoUrl: string | null) {
  const session = await prisma.session.create({ data: { name: `Session ${g.key} ${++counter}`, slug: `session-${g.key}-${counter}`, gameId: g.game.id, date } })
  await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: g.target.id, participantId: holder.id, photoUrl } })
  return session
}


describe('réglages et information (US-107)', () => {
  it('enregistre la durée et l’adresse de contact du jeu, et refuse une durée hors bornes', async () => {
    const { game } = await aliceGame()
    const saved = await api(alice, 'PUT', `/api/games/${game.id}`, { photoRetentionMonths: 12, contactEmail: 'Equipe@Example.test' }, { headers: { 'if-unmodified-since': game.updatedAt.toISOString() } })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(await prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { photoRetentionMonths: true, contactEmail: true } })).toEqual({ photoRetentionMonths: 12, contactEmail: 'equipe@example.test' })
    const fresh = await prisma.game.findUniqueOrThrow({ where: { id: game.id } })
    expect((await api(alice, 'PUT', `/api/games/${game.id}`, { photoRetentionMonths: 0 }, { headers: { 'if-unmodified-since': fresh.updatedAt.toISOString() } })).status).toBe(400)
  })

  it('le formulaire public donne l’information, avec le contact du jeu', async () => {
    const { key, game } = await aliceGame({ photoRetentionMonths: 3, contactEmail: 'orga@example.test' })
    await prisma.registrationPeriod.create({ data: { name: `Période ${key}`, gameId: game.id, publicId: `pub-${key}`, state: 'open', entryMode: 'form', scope: 'game' } })
    const read = await api(null, 'GET', `/api/public/periods/pub-${key}`)
    expect(read.status, JSON.stringify(read.body)).toBe(200)
    expect(body(read).game.photoInformation).toContain('supprimée 3 mois après la session')
    expect(body(read).game.photoInformation).toContain('orga@example.test')
  })

  it('sans adresse de contact, le lien de diffusion public ne montre pas celle de la propriétaire', async () => {
    const { key, game } = await aliceGame()
    await prisma.registrationPeriod.create({ data: { name: `Période ${key}`, gameId: game.id, publicId: `pub-${key}`, state: 'open', entryMode: 'form', scope: 'game' } })
    const information = body(await api(null, 'GET', `/api/public/periods/pub-${key}`)).game.photoInformation
    expect(information).toContain('« Je participe »')
    expect(information).not.toContain('alice@example.test')
  })
})

describe('durée et purge (US-108)', () => {
  it('supprime photos et trombinoscopes des sessions échues, pas des autres', async () => {
    const g = await aliceGame({ photoRetentionMonths: 6 })
    const lea = await g.person('Lea')
    const [old, recent, undated] = await Promise.all([photo(g.game.id), photo(g.game.id), photo(g.game.id)])
    const expired = await castSession(g, new Date(Date.now() - 400 * DAY), lea, old.url)
    const kept = await castSession(g, new Date(Date.now() - 10 * DAY), lea, recent.url)
    const noDate = await castSession(g, null, lea, undated.url)
    await prisma.sessionTrombinoscope.create({ data: { sessionId: expired.id, viewerCharacterId: g.viewer.id, participantId: lea.id, fileName: 't.pdf', contentHtml: '<p>x</p>' } })

    await triggerPurge(prisma)
    const photoOf = async (sessionId: string) => (await prisma.sessionAssignment.findFirstOrThrow({ where: { sessionId } })).photoUrl
    expect(await photoOf(expired.id)).toBeNull()
    expect(await prisma.sessionTrombinoscope.count({ where: { sessionId: expired.id } })).toBe(0)
    expect(existsSync(old.path)).toBe(false)
    expect(await photoOf(kept.id)).toBe(recent.url)
    expect(await photoOf(noDate.id)).toBe(undated.url)
    expect(existsSync(recent.path)).toBe(true)
  })
})

describe('retrait et refus (US-109)', () => {
  it('depuis son compte : retire ses photos, bloque les suivantes, et se lève', async () => {
    const g = await aliceGame()
    const user = await prisma.user.create({ data: { email: `compte-${g.key}@example.test`, name: 'Compte', password: 'non-utilise' } })
    const lou = await g.person('Lou', { userId: user.id, email: user.email })
    const picture = await photo(g.game.id)
    const session = await castSession(g, new Date(Date.now() + 30 * DAY), lou, picture.url)

    const refused = await api(user, 'POST', '/api/me/photo-refusal', { refused: true })
    expect(refused.status, JSON.stringify(refused.body)).toBe(200)
    expect(body(await api(user, 'GET', '/api/me/photo-refusal'))).toEqual({ refused: true })
    expect((await prisma.sessionAssignment.findFirstOrThrow({ where: { sessionId: session.id } })).photoUrl).toBeNull()
    expect(existsSync(picture.path)).toBe(false)

    // L'équipe ne peut plus lui mettre de photo, ni lever son refus
    const again = await photo(g.game.id)
    const current = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
    const cast = await api(alice, 'PUT', `/api/sessions/${session.id}`, {
      name: current.name, gameId: g.game.id, participants: [], assignments: [{ characterId: g.target.id, participantId: lou.id, photoUrl: again.url }]
    }, { headers: { 'if-unmodified-since': current.updatedAt.toISOString() } })
    expect(cast.status).toBe(400)
    expect(JSON.stringify(cast.body)).toContain('a refusé l’usage de sa photo')
    expect((await api(alice, 'POST', `/api/participants/${lou.id}/photo-refusal`, { refused: false })).status).toBe(403)

    expect((await api(user, 'POST', '/api/me/photo-refusal', { refused: false })).status).toBe(200)
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: lou.id } })).photoRefusedAt).toBeNull()

    const exported = await api(alice, 'GET', `/api/participants/${lou.id}/export`)
    expect(JSON.stringify(exported.body)).toContain('photoRefusedAt')
  })

  it('l’équipe pose et lève le refus d’une personne sans compte ; une autre équipe n’y touche pas', async () => {
    const g = await aliceGame()
    const max = await g.person('Max')
    expect((await api(bob, 'POST', `/api/participants/${max.id}/photo-refusal`, { refused: true })).status).toBe(404)
    expect((await api(alice, 'POST', `/api/participants/${max.id}/photo-refusal`, { refused: true })).status).toBe(200)
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: max.id } })).photoRefusedAt).not.toBeNull()
    expect((await api(alice, 'POST', `/api/participants/${max.id}/photo-refusal`, { refused: false })).status).toBe(200)
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: max.id } })).photoRefusedAt).toBeNull()
  })

  it('le trombinoscope ne montre pas la photo d’une personne qui l’a refusée', async () => {
    const g = await aliceGame()
    const [lea, noe] = await Promise.all([g.person('Lea'), g.person('Noe', { photoRefusedAt: new Date() })])
    const session = await prisma.session.create({ data: { name: `Session ${g.key}`, slug: `session-trombi-${g.key}`, gameId: g.game.id } })
    await prisma.sessionAssignment.createMany({ data: [
      { sessionId: session.id, characterId: g.viewer.id, participantId: lea.id },
      { sessionId: session.id, characterId: g.target.id, participantId: noe.id, photoUrl: '/api/uploads/session-assignment-photos/refusee.png' }
    ] })
    expect((await api(alice, 'POST', `/api/sessions/${session.id}/trombinoscopes/generate`, {})).status).toBe(200)
    const trombinoscope = await prisma.sessionTrombinoscope.findFirstOrThrow({ where: { sessionId: session.id, participantId: lea.id } })
    expect(trombinoscope.contentHtml).toContain(g.target.name)
    expect(trombinoscope.contentHtml).not.toContain('refusee.png')
  })
})
