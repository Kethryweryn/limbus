// SPEC-023, US-253 : une longueur maximale sur chaque texte saisi, des emails vérifiés partout
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api, invalidMessages, invalidPaths } from './api'
import { createTestPrisma } from './db'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

const gameId = () => world.a.game.id

describe('longueurs maximales (R9)', () => {
  it('un historique de personnage de 900 000 caractères s’enregistre et se relit ; un caractère de trop au plafond est refusé', async () => {
    const background = 'Il était une fois. '.repeat(50_000).slice(0, 899_999) + '.'
    const created = await api(alice, 'POST', '/api/characters', { name: `Long historique ${++counter}`, gameId: gameId(), background })
    expect(created.status, JSON.stringify(created.body).slice(0, 300)).toBe(200)
    const { id } = created.body as { id: string }
    expect((await prisma.character.findUniqueOrThrow({ where: { id }, select: { background: true } })).background).toHaveLength(900_000)

    const refused = await api(alice, 'POST', '/api/characters', { name: `Trop long ${++counter}`, gameId: gameId(), background: 'a'.repeat(1_000_001) })
    expect(refused.status).toBe(400)
    expect(invalidPaths(refused)).toEqual(['background'])
    expect(invalidMessages(refused)).toEqual(['Le background : 1 000 000 caractères au plus'])
  })

  it('refuse un nom de personnage, un titre de document ou une description d’intrigue trop longs, avec leur plafond', async () => {
    const name = await api(alice, 'POST', '/api/characters', { name: 'a'.repeat(201), gameId: gameId() })
    expect(invalidMessages(name)).toEqual(['Le nom : 200 caractères au plus'])

    const title = await api(alice, 'POST', '/api/documents', { title: 'a'.repeat(201), content: 'Texte', gameId: gameId() })
    expect(invalidPaths(title)).toEqual(['title'])

    const intrigue = await api(alice, 'POST', '/api/intrigues', { name: `Intrigue ${++counter}`, description: 'a'.repeat(50_001), gameId: gameId() })
    expect(invalidMessages(intrigue)).toEqual(['La description : 50 000 caractères au plus'])

    const location = await api(alice, 'POST', '/api/locations', { name: `Lieu ${++counter}`, address: 'a'.repeat(501), gameId: gameId() })
    expect(invalidPaths(location)).toEqual(['address'])
  })

  it('un document de 900 000 caractères s’enregistre (texte de fond)', async () => {
    const created = await api(alice, 'POST', '/api/documents', { title: `Long document ${++counter}`, content: 'a'.repeat(900_000), gameId: gameId() })
    expect(created.status, JSON.stringify(created.body).slice(0, 300)).toBe(200)
  })
})

describe('emails (R10)', () => {
  it('l’adresse de contact d’un jeu est mise en minuscules et refusée si elle n’a pas la forme d’une adresse', async () => {
    const game = await prisma.game.create({ data: { title: `Jeu des emails ${++counter}`, slug: `jeu-des-emails-${counter}`, description: '', ownerId: alice.id } })
    const refused = await api(alice, 'PUT', `/api/games/${game.id}`, { contactEmail: 'contact' })
    expect(refused.status).toBe(400)
    expect(invalidPaths(refused)).toEqual(['contactEmail'])
    expect(invalidMessages(refused)).toEqual(['Email invalide'])

    const saved = await api(alice, 'PUT', `/api/games/${game.id}`, { contactEmail: ' Contact@Jeu.TEST ' })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { contactEmail: true } })).contactEmail).toBe('contact@jeu.test')
    // Une modification qui n'envoie pas l'adresse la garde
    expect((await api(alice, 'PUT', `/api/games/${game.id}`, { title: `Jeu renommé ${counter}` })).status).toBe(200)
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { contactEmail: true } })).contactEmail).toBe('contact@jeu.test')
  })

  it('une invitation à co-organiser met l’adresse en minuscules', async () => {
    const game = await prisma.game.create({ data: { title: `Jeu partagé ${++counter}`, slug: `jeu-partage-emails-${counter}`, description: '', ownerId: alice.id } })
    const email = `Invitee-${counter}@Example.TEST`
    const invited = await api(alice, 'POST', `/api/games/${game.id}/invitations`, { email })
    expect(invited.status, JSON.stringify(invited.body)).toBe(200)
    expect(await prisma.gameInvitation.count({ where: { gameId: game.id, email: email.toLowerCase() } })).toBe(1)
    expect(invalidPaths(await api(alice, 'POST', `/api/games/${game.id}/invitations`, { email: 'sans-arobase' }))).toEqual(['email'])
  })
})
