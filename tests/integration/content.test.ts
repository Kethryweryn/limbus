// Validation des URL, suppressions en cascade, nettoyage des fichiers téléversés, ressources figées dans leur jeu
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import bcrypt from 'bcrypt'
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
    const photo = await upload('photo', a.game.id)
    expect((await api(alice, 'PUT', `/api/games/${a.game.id}`, { teaserUrl: 'https://youtu.be/dQw4w9WgXcQ' })).status).toBe(200)
    expect((await api(alice, 'PUT', `/api/characters/${a.character.id}`, {
      backgroundDocumentUrl: 'https://docs.example/fiche',
      trombinoscopePhotoUrl: photo.url
    })).status).toBe(200)
  })

  it('accepte dans une session les photos et le RIB téléversés pour le jeu (témoin)', async () => {
    const { game, character, session } = await aliceGame('fichiers-session')
    const photo = await upload('photo', game.id, session.id)
    const rib = await upload('rib', game.id, session.id)
    expect((await api(alice, 'PUT', `/api/sessions/${session.id}/payments/settings`, { paymentRibUrl: rib.url })).status).toBe(200)
    // Une photo prise pour une autre session du même jeu peut resservir
    const created = await api(alice, 'POST', '/api/sessions', { name: 'Autre session fichiers', gameId: game.id, assignments: [{ characterId: character.id, photoUrl: photo.url }] })
    expect(created.status, JSON.stringify(created.body)).toBe(200)
    const updated = await api(alice, 'PUT', `/api/sessions/${session.id}`, { name: session.name, gameId: game.id, assignments: [{ characterId: character.id, photoUrl: photo.url }] })
    expect(updated.status, JSON.stringify(updated.body)).toBe(200)
    // Modifier le seul lien de paiement garde le RIB
    expect((await api(alice, 'PUT', `/api/sessions/${session.id}/payments/settings`, { paymentLinkUrl: 'https://paiement.example/x' })).status).toBe(200)
    expect((await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).paymentRibUrl).toBe(rib.url)
  })

  it('refuse comme photo de personnage un fichier d’un autre jeu ou la photo d’un joueur', async () => {
    const { game, session } = await aliceGame('photo-etrangere')
    const playerPhoto = await upload('photo', game.id, session.id)
    const otherGamePhoto = await upload('photo', world.b.game.id)
    for (const url of [playerPhoto.url, otherGamePhoto.url]) {
      expect((await api(alice, 'POST', '/api/characters', { name: 'Intrus', gameId: game.id, trombinoscopePhotoUrl: url })).status).toBe(400)
    }
    const character = await prisma.character.findFirstOrThrow({ where: { gameId: game.id } })
    expect((await api(alice, 'PUT', `/api/characters/${character.id}`, { trombinoscopePhotoUrl: playerPhoto.url })).status).toBe(400)
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

describe('connexion', () => {
  it('ne dépend pas de la casse de l’email', async () => {
    await prisma.user.create({ data: { email: 'casse@example.test', name: 'Casse', password: await bcrypt.hash('mot-de-passe-solide', 4) } })

    const response = await fetch(`${inject('baseUrl')}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ' Casse@Example.TEST ', password: 'mot-de-passe-solide' })
    })
    expect(await response.json()).toEqual({ success: true })
    expect(response.headers.get('set-cookie')).toContain('limbus_token=')
  })

  it('un mauvais mot de passe répond 401 avec un message', async () => {
    const response = await api(null, 'POST', '/api/auth/login', { email: 'casse@example.test', password: 'mauvais-mot-de-passe' })
    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ message: 'Email ou mot de passe incorrect' })
  })

  it('un compte créé par un admin avec des majuscules est enregistré en minuscules', async () => {
    const response = await api(world.users.admin, 'POST', '/api/admin/users', { email: 'Nouveau.Compte@Example.test', name: 'Nouveau', password: 'mot-de-passe-solide' })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ email: 'nouveau.compte@example.test' })
  })
})

describe('créations simultanées du même nom', () => {
  it('ne provoquent pas d’erreur 500 et reçoivent chacune un slug distinct', async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () =>
      api(alice, 'POST', '/api/factions', { name: 'Groupe en double', gameId: a.game.id })
    ))
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200])
    const slugs = responses.map((response) => (response.body as { slug: string }).slug)
    expect(new Set(slugs).size).toBe(5)
  })
})

describe('trombinoscopes après un changement de distribution', () => {
  it('celui de l’ancien joueur n’est plus servi, et disparaît à la génération suivante', async () => {
    const { game, character, participant, session } = await aliceGame('trombi')
    const remplacant = await prisma.participant.create({
      data: { name: 'Remplaçant', slug: 'joueur-contenu-remplacant', gameLinks: { create: { gameId: game.id } } }
    })
    const assignment = await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, participantId: participant.id } })
    const url = `/api/sessions/${session.id}/trombinoscopes/${character.id}`

    expect((await api(alice, 'POST', `/api/sessions/${session.id}/trombinoscopes/generate`, {})).status).toBe(200)
    expect((await api(alice, 'GET', url)).status).toBe(200)

    await prisma.sessionAssignment.update({ where: { id: assignment.id }, data: { participantId: remplacant.id } })
    expect((await api(alice, 'GET', url)).status).toBe(404)

    expect((await api(alice, 'POST', `/api/sessions/${session.id}/trombinoscopes/generate`, {})).status).toBe(200)
    expect((await api(alice, 'GET', url)).status).toBe(200)
    expect(await prisma.sessionTrombinoscope.findMany({ where: { sessionId: session.id }, select: { participantId: true } }))
      .toEqual([{ participantId: remplacant.id }])
  })
})
