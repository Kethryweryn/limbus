// SPEC-023, US-251 : un nom de personne ne contient que des lettres et des séparateurs, sur chaque route qui en écrit un
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api, invalidMessages, invalidPaths } from './api'
import { createTestPrisma } from './db'

const world = inject('world')
const { admin, alice } = world.users
const prisma = createTestPrisma()
let counter = 0
const unique = (name: string) => `${name}-noms-${++counter}@example.test`
const REFUSED = 'Le nom ne peut contenir que des lettres, des espaces, des traits d’union, des apostrophes et des points'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('noms de personnes (SPEC-023, R1, R2)', () => {
  it('fiche participant : refuse un nom avec des chiffres, accepte accents et séparateurs, et retire les espaces en trop', async () => {
    const email = unique('fiche')
    const refused = await api(alice, 'POST', '/api/participants', { name: 'Léa 2', email, gameIds: [world.a.game.id] })
    expect(refused.status).toBe(400)
    expect(invalidPaths(refused)).toEqual(['name'])
    expect(invalidMessages(refused)).toEqual([REFUSED])
    expect(await prisma.participant.count({ where: { email } })).toBe(0)

    const created = await api(alice, 'POST', '/api/participants', { name: '  Anne-Sophie   D’Arc ', email, gameIds: [world.a.game.id] })
    expect(created.status, JSON.stringify(created.body)).toBe(200)
    const { id, updatedAt } = created.body as { id: string, updatedAt: string }
    expect(await prisma.participantGame.findFirst({ where: { participantId: id }, select: { name: true } })).toEqual({ name: 'Anne-Sophie D’Arc' })

    const renamed = await api(alice, 'PUT', `/api/participants/${id}`, { name: '@nne', email, gameIds: [world.a.game.id] }, { headers: { 'if-unmodified-since': updatedAt } })
    expect(renamed.status).toBe(400)
    expect(invalidPaths(renamed)).toEqual(['name'])
  })

  it('compte : nom et nom du contact d’urgence', async () => {
    const user = await prisma.user.create({ data: { email: unique('compte'), name: 'Camille Dupont', password: 'non-utilise', emailConfirmedAt: new Date() } })
    const name = await api(user, 'PUT', '/api/account', { name: 'Camille 3' })
    expect(name.status).toBe(400)
    expect(invalidPaths(name)).toEqual(['name'])
    expect((await api(user, 'PUT', '/api/account', { name: 'Ŝofia Ñúñez' })).status).toBe(200)

    const profile = await api(user, 'PUT', '/api/account/profile', { emergencyContactName: 'Paul#', emergencyContactPhone: '0611111111' })
    expect(profile.status).toBe(400)
    expect(invalidPaths(profile)).toEqual(['emergencyContactName'])
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, emergencyContactName: true } })).toEqual({ name: 'Ŝofia Ñúñez', emergencyContactName: null })
  })

  it('administration : création et modification d’un compte', async () => {
    const email = unique('admin')
    const created = await api(admin, 'POST', '/api/admin/users', { name: 'Compte_1', email })
    expect(created.status).toBe(400)
    expect(invalidPaths(created)).toEqual(['name'])
    expect(await prisma.user.count({ where: { email } })).toBe(0)

    const user = await prisma.user.create({ data: { email, name: 'Dominique', password: 'non-utilise' } })
    const updated = await api(admin, 'PUT', `/api/admin/users/${user.id}`, { name: 'Dominique 2' })
    expect(updated.status).toBe(400)
    expect(invalidPaths(updated)).toEqual(['name'])
  })

  it('invitation au vivier d’une nouvelle personne', async () => {
    const key = `vivier-noms-${++counter}`
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: key, state: 'open' } })
    const email = unique('invitee')
    const refused = await api(alice, 'POST', `/api/registration-periods/${period.id}/invitations`, { newParticipant: { name: 'Invitée 1', email } })
    expect(refused.status).toBe(400)
    expect(invalidPaths(refused)).toEqual(['newParticipant.name'])
    expect(await prisma.participant.count({ where: { email } })).toBe(0)
  })
})
