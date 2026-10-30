// EPIC-018 : copie de chaque envoi (US-078), documents dans « Je participe » (US-079), nettoyage après la session (US-080)
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api, DENIED, tokenFor } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp } from './smtp'

const prisma = createTestPrisma()
const { bob } = inject('world').users
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0
const DAY = 24 * 60 * 60 * 1000
const PHOTOS = join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(64).fill(1)])

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

type Reading = {
  source: 'copy' | 'current' | null
  title: string
  text: { sections: Array<{ title?: string, body?: string }> } | null
  cards: Array<{ displayName: string, photoUrl: string | null }> | null
}
type Participations = Array<{ sessions: Array<{ id: string, documents: Array<{ id: string, kind: string, available: boolean }> }> }>

// Un jeu d'une propriétaire à elle, une session dans 10 jours, et une joueuse avec un compte, castée et PNJ
async function world() {
  const k = `docs-${++counter}`
  const owner = await prisma.user.create({ data: { email: `proprio-${k}@example.test`, name: 'Proprio', password: 'non-utilise' } })
  const player = await prisma.user.create({ data: { email: `joueuse-${k}@example.test`, name: 'Joueuse', password: 'non-utilise' } })
  const game = await prisma.game.create({ data: { title: `Jeu ${k}`, slug: `jeu-${k}`, description: '', ownerId: owner.id } })
  const session = await prisma.session.create({ data: { name: `Session ${k}`, slug: `session-${k}`, gameId: game.id, date: new Date(Date.now() + 10 * DAY) } })
  const participant = await prisma.participant.create({
    data: { name: 'Joueuse', slug: `joueuse-${k}`, email: player.email, userId: player.id, gameLinks: { create: { gameId: game.id } } }
  })
  await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'npc' } })
  const document = await prisma.document.create({
    data: { title: `Lettre ${k}`, slug: `lettre-${k}`, gameId: game.id, content: 'Version envoyée', readyToSend: true, audience: 'everyone' }
  })
  return { k, owner, player, game, session, participant, document }
}

const deliveryOf = (participantId: string, kind: string) =>
  prisma.sessionDocumentDelivery.findFirstOrThrow({ where: { participantId, kind }, select: { id: true, copySize: true } })
const read = async (user: { id: string }, id: string) => {
  const response = await api(user, 'GET', `/api/me/documents/${id}`)
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  return response.body as Reading
}
const sectionsText = (reading: Reading) => JSON.stringify(reading.text?.sections)
const usedBytes = async (user: { id: string }) => ((await api(user, 'GET', '/api/account')).body as { storage: { usedBytes: number } }).storage.usedBytes
// La purge passe à chaque connexion, réussie ou non (ADR-0044)
const purge = () => api(null, 'POST', '/api/auth/login', { email: 'personne@example.test', password: 'mauvais-mot-de-passe' })

describe('copie de chaque envoi (US-078) et lecture dans « Je participe » (US-079)', () => {
  it('la personne lit ce qu’elle a reçu, même modifié depuis, et le renvoi remplace la copie', async () => {
    const { owner, player, session, participant, document } = await world()
    const before = await usedBytes(owner)
    expect((await api(owner, 'POST', `/api/sessions/${session.id}/documents/send`, { documentIds: [document.id] })).body).toMatchObject({ sentCount: 1 })

    const delivery = await deliveryOf(participant.id, 'document')
    expect(delivery.copySize).toBeGreaterThan(0)
    expect(await usedBytes(owner)).toBe(before + delivery.copySize!)

    const listed = (await api(player, 'GET', '/api/me/participations')).body as Participations
    expect(listed[0]!.sessions.find((item) => item.id === session.id)!.documents).toEqual([
      expect.objectContaining({ id: delivery.id, kind: 'document', available: true })
    ])

    await prisma.document.update({ where: { id: document.id }, data: { content: 'Brouillon pas encore envoyé' } })
    const reading = await read(player, delivery.id)
    expect(reading.source).toBe('copy')
    expect(sectionsText(reading)).toContain('Version envoyée')
    expect(sectionsText(reading)).not.toContain('Brouillon')

    const pdf = await fetch(`${inject('baseUrl')}/api/me/documents/${delivery.id}/pdf`, { headers: { cookie: `limbus_token=${tokenFor(player)}` } })
    expect(pdf.status).toBe(200)
    expect(pdf.headers.get('content-type')).toBe('application/pdf')
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF')

    // Ni une autre personne, ni l'équipe : l'espace part des fiches rattachées au compte
    expect(DENIED).toContain((await api(bob, 'GET', `/api/me/documents/${delivery.id}`)).status)
    expect(DENIED).toContain((await api(owner, 'GET', `/api/me/documents/${delivery.id}`)).status)
    expect(DENIED).toContain((await api(bob, 'GET', `/api/me/documents/${delivery.id}/pdf`)).status)

    expect((await api(owner, 'POST', `/api/sessions/${session.id}/documents/resend`, { kind: 'document', documentId: document.id, participantId: participant.id })).body).toMatchObject({ sentCount: 1 })
    expect(sectionsText(await read(player, delivery.id))).toContain('Brouillon pas encore envoyé')
    expect(await prisma.sessionDocumentDelivery.count({ where: { participantId: participant.id, kind: 'document' } })).toBe(1)
  })

  it('le trombinoscope se lit avec ses photos, copiées à l’envoi', async () => {
    const { k, owner, player, game, session, participant } = await world()
    const [viewer, other] = await Promise.all(['Lea', 'Noe'].map((name) => prisma.character.create({ data: { name: `${name} ${k}`, slug: `${name.toLowerCase()}-${k}`, gameId: game.id } })))
    const filename = `copie-${k}.png`
    await mkdir(PHOTOS, { recursive: true })
    await writeFile(join(PHOTOS, filename), PNG)
    const photoUrl = `/api/uploads/session-assignment-photos/${filename}`
    await prisma.uploadedFile.create({ data: { kind: 'session-assignment-photo', filename, url: photoUrl, gameId: game.id, size: PNG.length } })
    const otherPlayer = await prisma.participant.create({ data: { name: 'Autre', slug: `autre-${k}`, email: `autre-${k}@example.test`, gameLinks: { create: { gameId: game.id } } } })
    await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: viewer!.id, participantId: participant.id } })
    await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: other!.id, participantId: otherPlayer.id, photoUrl } })
    await prisma.characterTrombinoscopeEntry.create({ data: { viewerCharacterId: viewer!.id, targetCharacterId: other!.id, included: true, faceKnown: true } })

    expect((await api(owner, 'POST', `/api/sessions/${session.id}/trombinoscopes/generate`, {})).status).toBe(200)
    const sent = await api(owner, 'POST', `/api/sessions/${session.id}/documents/send-trombinoscopes`, {})
    expect(sent.body).toMatchObject({ sentCount: 2 })

    const delivery = await deliveryOf(participant.id, 'trombinoscope')
    const reading = await read(player, delivery.id)
    expect(reading.source).toBe('copy')
    expect(reading.cards).toEqual([expect.objectContaining({ displayName: other!.name, photoUrl: expect.stringContaining(`/api/me/documents/${delivery.id}/photos/0`) })])
    const photo = await api(player, 'GET', reading.cards![0]!.photoUrl!)
    expect(photo.status).toBe(200)
    expect(DENIED).toContain((await api(bob, 'GET', reading.cards![0]!.photoUrl!)).status)

    // Effacer la personne photographiée efface aussi les copies de trombinoscope qui la montrent
    expect((await api(owner, 'DELETE', `/api/participants/${otherPlayer.id}`)).status).toBeLessThan(300)
    expect((await deliveryOf(participant.id, 'trombinoscope')).copySize).toBeNull()
    expect((await read(player, delivery.id)).source).toBeNull()
  })
})

describe('copies effacées après la session (US-080)', () => {
  it('le lendemain de la session, la personne lit la version actuelle, tant qu’elle reste prête', async () => {
    const { owner, player, session, participant, document } = await world()
    expect((await api(owner, 'POST', `/api/sessions/${session.id}/documents/send`, { documentIds: [document.id] })).status).toBe(200)
    const { id } = await deliveryOf(participant.id, 'document')
    await prisma.document.update({ where: { id: document.id }, data: { content: 'Version après le jeu' } })

    await prisma.session.update({ where: { id: session.id }, data: { date: new Date(Date.now() - 2 * DAY) } })
    // Pas encore effacée, mais plus servie
    expect((await deliveryOf(participant.id, 'document')).copySize).not.toBeNull()
    const current = await read(player, id)
    expect(current.source).toBe('current')
    expect(sectionsText(current)).toContain('Version après le jeu')

    await purge()
    expect((await deliveryOf(participant.id, 'document')).copySize).toBeNull()

    await prisma.document.update({ where: { id: document.id }, data: { readyToSend: false } })
    expect((await read(player, id)).source).toBeNull()
    expect(DENIED).toContain((await api(player, 'GET', `/api/me/documents/${id}/pdf`)).status)
    const listed = (await api(player, 'GET', '/api/me/participations')).body as Participations
    expect(listed[0]!.sessions[0]!.documents[0]).toMatchObject({ id, available: false })
  })

  it('une session annulée garde ses copies un mois après l’annulation', async () => {
    const { owner, game, session, participant, document } = await world()
    expect((await api(owner, 'POST', `/api/sessions/${session.id}/documents/send`, { documentIds: [document.id] })).status).toBe(200)
    await prisma.session.update({ where: { id: session.id }, data: { date: new Date(Date.now() - 2 * DAY) } })
    const cancelled = await api(owner, 'PUT', `/api/sessions/${session.id}`, { name: session.name, gameId: game.id, status: 'cancelled', date: session.date!.toISOString() })
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200)
    expect((await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).cancelledAt).not.toBeNull()

    await purge()
    expect((await deliveryOf(participant.id, 'document')).copySize).not.toBeNull()

    await prisma.session.update({ where: { id: session.id }, data: { cancelledAt: new Date(Date.now() - 32 * DAY) } })
    await purge()
    expect((await deliveryOf(participant.id, 'document')).copySize).toBeNull()
  })

  it('une session reportée garde ses copies jusqu’au lendemain de celle qui la remplace', async () => {
    const { owner, session, participant, document } = await world()
    expect((await api(owner, 'POST', `/api/sessions/${session.id}/documents/send`, { documentIds: [document.id] })).status).toBe(200)
    const postponed = await api(owner, 'POST', `/api/sessions/${session.id}/postpone`, { name: `${session.name} reportée`, date: new Date(Date.now() + 30 * DAY).toISOString() })
    expect(postponed.status, JSON.stringify(postponed.body)).toBe(200)
    const replacement = postponed.body as { id: string }

    await prisma.session.update({ where: { id: session.id }, data: { date: new Date(Date.now() - 2 * DAY) } })
    await purge()
    expect((await deliveryOf(participant.id, 'document')).copySize).not.toBeNull()

    await prisma.session.update({ where: { id: replacement.id }, data: { date: new Date(Date.now() - 2 * DAY) } })
    await purge()
    expect((await deliveryOf(participant.id, 'document')).copySize).toBeNull()
  })

  it('une fiche n’est plus lisible, sans copie, quand le rôle est distribué à quelqu’un d’autre', async () => {
    const { k, owner, player, game, session, participant } = await world()
    const character = await prisma.character.create({ data: { name: `Role ${k}`, slug: `role-${k}`, gameId: game.id, background: 'Pour la joueuse', sheetReadyToSend: true } })
    await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, participantId: participant.id } })
    expect((await api(owner, 'POST', `/api/sessions/${session.id}/documents/send-character-sheets`, {})).body).toMatchObject({ sentCount: 1 })
    const { id } = await deliveryOf(participant.id, 'character_sheet')

    await prisma.session.update({ where: { id: session.id }, data: { date: new Date(Date.now() - 2 * DAY) } })
    expect((await read(player, id)).source).toBe('current')

    const other = await prisma.participant.create({ data: { name: 'Autre', slug: `autre-role-${k}`, gameLinks: { create: { gameId: game.id } } } })
    await prisma.sessionAssignment.update({ where: { sessionId_characterId: { sessionId: session.id, characterId: character.id } }, data: { participantId: other.id } })
    expect((await read(player, id)).source).toBeNull()
  })
})
