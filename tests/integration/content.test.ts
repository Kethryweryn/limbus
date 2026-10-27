// Validation des URL, suppressions en cascade, nettoyage des fichiers téléversés, ressources figées dans leur jeu
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'

const world = inject('world')
const { alice } = world.users
const { a } = world
const prisma = createTestPrisma()

const PHOTOS = join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')
const RIBS = join(process.cwd(), '.data', 'uploads', 'session-payment-ribs')
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

// Fichier téléversé « réel » : présent sur le disque et enregistré en base
async function upload(kind: 'photo' | 'rib', gameId: string, sessionId?: string) {
  const extension = kind === 'photo' ? 'png' : 'pdf'
  const filename = `contenu-${kind}-${++counter}.${extension}`
  const url = `/api/uploads/${kind === 'photo' ? 'session-assignment-photos' : 'session-payment-ribs'}/${filename}`
  const dir = kind === 'photo' ? PHOTOS : RIBS
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), 'x')
  await prisma.uploadedFile.create({
    data: { kind: kind === 'photo' ? 'session-assignment-photo' : 'session-payment-rib', filename, url, gameId, sessionId }
  })
  return { url, path: join(dir, filename) }
}

async function aliceGame(key: string) {
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-contenu-${key}`, description: '', ownerId: alice.id } })
  const character = await prisma.character.create({ data: { name: `Perso ${key}`, slug: `perso-contenu-${key}`, gameId: game.id } })
  const participant = await prisma.participant.create({
    data: { name: `Joueur ${key}`, slug: `joueur-contenu-${key}`, gameLinks: { create: { gameId: game.id } } }
  })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-contenu-${key}`, gameId: game.id } })
  return { game, character, participant, session }
}

describe('URL saisies par les organisateurs', () => {
  it.each([
    ['PUT', () => `/api/games/${a.game.id}`, { teaserUrl: 'javascript:alert(document.cookie)' }],
    ['PUT', () => `/api/characters/${a.character.id}`, { backgroundDocumentUrl: 'javascript:alert(1)' }],
    ['PUT', () => `/api/characters/${a.character.id}`, { trombinoscopePhotoUrl: 'data:image/svg+xml,<svg onload=alert(1)>' }],
    ['PUT', () => `/api/characters/${a.character.id}`, { trombinoscopePhotoUrl: '/api/uploads/session-assignment-photos/../../.env' }],
    ['PUT', () => `/api/documents/${a.document.id}`, { title: 'Doc', documentUrl: 'javascript:alert(1)', gameId: a.game.id }],
    ['PUT', () => `/api/sessions/${a.session.id}/payments/settings`, { paymentLinkUrl: 'javascript:alert(1)' }],
    ['PUT', () => `/api/sessions/${a.session.id}/payments/settings`, { paymentRibUrl: '/etc/passwd' }]
  ] as const)('%s %s refuse un lien dangereux', async (method, path, body) => {
    expect((await api(alice, method, path(), body)).status).toBe(400)
  })

  it('accepte les liens http(s) et les fichiers téléversés (témoin)', async () => {
    expect((await api(alice, 'PUT', `/api/games/${a.game.id}`, { teaserUrl: 'https://youtu.be/dQw4w9WgXcQ' })).status).toBe(200)
    expect((await api(alice, 'PUT', `/api/characters/${a.character.id}`, {
      backgroundDocumentUrl: 'https://docs.example/fiche',
      trombinoscopePhotoUrl: '/api/uploads/session-assignment-photos/photo-a.png'
    })).status).toBe(200)
  })
})

describe('suppressions', () => {
  it('un jeu avec contenu se supprime, avec ses fichiers', async () => {
    const { game, character, participant, session } = await aliceGame('supprime')
    const photo = await upload('photo', game.id, session.id)
    const rib = await upload('rib', game.id, session.id)
    await prisma.session.update({
      where: { id: session.id },
      data: { paymentRibUrl: rib.url, assignments: { create: { characterId: character.id, participantId: participant.id, photoUrl: photo.url } } }
    })
    await prisma.faction.create({ data: { name: 'Groupe', slug: 'groupe-contenu-supprime', gameId: game.id } })

    expect((await api(alice, 'DELETE', `/api/games/${game.id}`)).status).toBe(200)

    expect(await prisma.game.findUnique({ where: { id: game.id } })).toBeNull()
    expect(await prisma.character.count({ where: { gameId: game.id } })).toBe(0)
    expect(await prisma.session.count({ where: { gameId: game.id } })).toBe(0)
    expect(existsSync(photo.path)).toBe(false)
    expect(existsSync(rib.path)).toBe(false)
    // Le participant existe hors des jeux : il reste, sans lien vers le jeu supprimé
    expect(await prisma.participant.findUnique({ where: { id: participant.id } })).not.toBeNull()
  })

  it('un personnage distribué dans une session se supprime, avec la photo de son assignation', async () => {
    const { game, character, participant, session } = await aliceGame('perso')
    const photo = await upload('photo', game.id, session.id)
    await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, participantId: participant.id, photoUrl: photo.url } })

    expect((await api(alice, 'DELETE', `/api/characters/${character.id}`)).status).toBe(200)

    expect(await prisma.sessionAssignment.count({ where: { characterId: character.id } })).toBe(0)
    expect(existsSync(photo.path)).toBe(false)
  })

  it('supprimer une session efface ses photos et son RIB, mais garde une photo réutilisée ailleurs', async () => {
    const { game, character, participant, session } = await aliceGame('session')
    const other = await prisma.session.create({ data: { name: 'Autre', slug: 'session-contenu-autre', gameId: game.id } })
    const photo = await upload('photo', game.id, session.id)
    const shared = await upload('photo', game.id, session.id)
    const rib = await upload('rib', game.id, session.id)
    const otherCharacter = await prisma.character.create({ data: { name: 'Autre perso', slug: 'perso-contenu-autre', gameId: game.id } })
    await prisma.session.update({
      where: { id: session.id },
      data: {
        paymentRibUrl: rib.url,
        assignments: { create: [
          { characterId: character.id, participantId: participant.id, photoUrl: photo.url },
          { characterId: otherCharacter.id, photoUrl: shared.url }
        ] }
      }
    })
    await prisma.sessionAssignment.create({ data: { sessionId: other.id, characterId: character.id, photoUrl: shared.url } })

    expect((await api(alice, 'DELETE', `/api/sessions/${session.id}`)).status).toBe(200)

    expect(existsSync(photo.path)).toBe(false)
    expect(existsSync(rib.path)).toBe(false)
    expect(existsSync(shared.path)).toBe(true)
  })
})

describe('fichiers remplacés', () => {
  it('changer la photo d’une assignation efface l’ancienne', async () => {
    const { game, character, participant, session } = await aliceGame('remplace')
    const before = await upload('photo', game.id, session.id)
    const after = await upload('photo', game.id, session.id)
    await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, participantId: participant.id, photoUrl: before.url } })

    const response = await api(alice, 'PUT', `/api/sessions/${session.id}`, {
      name: session.name,
      gameId: game.id,
      assignments: [{ characterId: character.id, participantId: participant.id, photoUrl: after.url }]
    })
    expect(response.status).toBe(200)

    expect(existsSync(before.path)).toBe(false)
    expect(await prisma.uploadedFile.findUnique({ where: { url: before.url } })).toBeNull()
    expect(existsSync(after.path)).toBe(true)
  })

  it('remplacer le RIB efface l’ancien', async () => {
    const { game, session } = await aliceGame('rib')
    const before = await upload('rib', game.id, session.id)
    const after = await upload('rib', game.id, session.id)
    await prisma.session.update({ where: { id: session.id }, data: { paymentRibUrl: before.url } })

    expect((await api(alice, 'PUT', `/api/sessions/${session.id}/payments/settings`, { paymentRibUrl: after.url })).status).toBe(200)

    expect(existsSync(before.path)).toBe(false)
    expect(existsSync(after.path)).toBe(true)
  })
})

describe('une ressource ne change pas de jeu', () => {
  it.each([
    ['characters', () => a.character.id, (gameId: string) => ({ gameId })],
    ['factions', () => a.faction.id, (gameId: string) => ({ name: 'Groupe', gameId })],
    ['items', () => a.item.id, (gameId: string) => ({ name: 'Objet', gameId })],
    ['sessions', () => a.session.id, (gameId: string) => ({ name: 'Session', gameId })]
  ] as const)('PUT /api/%s vers un autre jeu d’Alice est refusé', async (path, id, body) => {
    const { game } = await aliceGame(`deplace-${path}`)
    expect((await api(alice, 'PUT', `/api/${path}/${id()}`, body(game.id))).status).toBe(400)
  })
})
