// US-178 : contact d'urgence et allergies sur la fiche participante (SPEC-007, R1b)
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf } from './api'
import { createTestPrisma } from './db'
import { withFicheValues } from '../fiche'

const world = inject('world')
const { alice, bob } = world.users
const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

type Emergency = ApiResponse<'/api/participants/:id/emergency'>

async function gameOf(ownerId: string, key: string) {
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId } })
  const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `pub-${key}`, state: 'open' } })
  return { game, period }
}

function registrationIn(period: { id: string, gameId: string }, participantId: string, data: { respondedAt: Date | null, emergencyContactName: string, dietary: string | null }) {
  return prisma.registration.create({
    data: { gameId: period.gameId, periodId: period.id, participantId, status: data.respondedAt ? 'received' : 'invited', source: 'invitation', email: `urgence-${++counter}@example.test`, emergencyContactPhone: '0699999999', ...data }
  })
}

async function read(participantId: string) {
  const response = await api(alice, 'GET', `/api/participants/${participantId}/emergency`)
  expect(response.status).toBe(200)
  return bodyOf<Emergency>(response)
}

describe('urgence et allergies de la fiche', () => {
  it('lit l’inscription répondue la plus récente dans mes jeux, jamais celle d’une autre équipe', async () => {
    const key = `urgence-${++counter}`
    const mine = await gameOf(alice.id, `${key}-a`)
    const other = await gameOf(bob.id, `${key}-b`)
    const participant = await withFicheValues(prisma.participant.create({
      data: { slug: `zoe-${key}`, gameLinks: { create: [{ gameId: mine.game.id , name: `Zoé ${key}` }, { gameId: other.game.id , name: `Zoé ${key}` }] } }
    }), { name: `Zoé ${key}` })
    await registrationIn(mine.period, participant.id, { respondedAt: new Date(), emergencyContactName: 'Contact Alice', dietary: 'Gluten' })
    // Plus récente, mais chez Bob : ignorée
    await registrationIn(other.period, participant.id, { respondedAt: new Date(), emergencyContactName: 'Contact Bob', dietary: 'Arachides' })

    expect(await read(participant.id)).toEqual({
      source: 'registration',
      gameTitle: mine.game.title,
      emergencyContactName: 'Contact Alice',
      emergencyContactPhone: '0699999999',
      dietary: 'Gluten'
    })
    // Témoin : Bob lit la sienne
    const forBob = await api(bob, 'GET', `/api/participants/${participant.id}/emergency`)
    expect(bodyOf<Emergency>(forBob)).toMatchObject({ emergencyContactName: 'Contact Bob', dietary: 'Arachides' })
  })

  it('ignore une invitation sans réponse et prend alors le compte, les allergies seulement avec l’accord santé', async () => {
    const key = `urgence-${++counter}`
    const mine = await gameOf(alice.id, key)
    const user = await prisma.user.create({
      data: { email: `${key}@example.test`, name: `Léo ${key}`, password: 'x', emergencyContactName: 'Contact compte', emergencyContactPhone: '0611111111', dietary: 'Lactose', profileUpdatedAt: new Date() }
    })
    const participant = await withFicheValues(prisma.participant.create({
      data: { slug: `leo-${key}`, userId: user.id, gameLinks: { create: { gameId: mine.game.id , name: `Léo ${key}` } } }
    }), { name: `Léo ${key}` })
    await registrationIn(mine.period, participant.id, { respondedAt: null, emergencyContactName: 'Jamais rempli', dietary: 'Jamais rempli' })

    expect(await read(participant.id)).toEqual({ source: 'account', gameTitle: null, emergencyContactName: 'Contact compte', emergencyContactPhone: '0611111111', dietary: null })

    await prisma.user.update({ where: { id: user.id }, data: { healthConsentAt: new Date() } })
    expect(await read(participant.id)).toMatchObject({ source: 'account', dietary: 'Lactose' })
  })

  it('ne montre rien sans inscription ni coordonnées enregistrées dans le compte', async () => {
    const key = `urgence-${++counter}`
    const mine = await gameOf(alice.id, key)
    const user = await prisma.user.create({ data: { email: `${key}@example.test`, name: `Inès ${key}`, password: 'x', emergencyContactName: 'Pas encore enregistré' } })
    const participant = await withFicheValues(prisma.participant.create({
      data: { slug: `ines-${key}`, userId: user.id, gameLinks: { create: { gameId: mine.game.id , name: `Inès ${key}` } } }
    }), { name: `Inès ${key}` })
    expect(await read(participant.id)).toEqual({ source: null, gameTitle: null, emergencyContactName: null, emergencyContactPhone: null, dietary: null })
  })

  it('n’apparaît ni dans la fiche ni dans la liste', async () => {
    const key = `urgence-${++counter}`
    const mine = await gameOf(alice.id, key)
    const participant = await withFicheValues(prisma.participant.create({ data: { slug: `hugo-${key}`, gameLinks: { create: { gameId: mine.game.id , name: `Hugo ${key}` } } } }), { name: `Hugo ${key}` })
    await registrationIn(mine.period, participant.id, { respondedAt: new Date(), emergencyContactName: 'Contact caché', dietary: 'Soja' })
    const sheet = JSON.stringify((await api(alice, 'GET', `/api/participants/${participant.id}`)).body)
    const list = JSON.stringify((await api(alice, 'GET', `/api/participants?gameId=${mine.game.id}`)).body)
    for (const json of [sheet, list]) {
      expect(json).not.toContain('Contact caché')
      expect(json).not.toContain('Soja')
    }
  })
})
