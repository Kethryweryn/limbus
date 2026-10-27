// US-002 : note d'intention et champs standards du formulaire d'inscription (SPEC-001 R8, R9, R14)
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'

const world = inject('world')
const { alice, carol } = world.users
const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

async function aliceGame() {
  const key = `formulaire-${++counter}`
  return await prisma.game.create({
    data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', noteIntention: 'Jeu sombre, consentement et sécurité émotionnelle.', ownerId: alice.id }
  })
}

const definition = (changes: Record<string, { asked: boolean, required: boolean }> = {}) => ({
  standardFields: {
    lastName: { asked: true, required: true },
    firstName: { asked: true, required: true },
    facebookName: { asked: false, required: false },
    phone: { asked: true, required: true },
    emergencyContact: { asked: true, required: true },
    dietary: { asked: true, required: false },
    ...changes
  }
})

describe('formulaire d’inscription d’un jeu', () => {
  it('sans formulaire enregistré, renvoie la définition par défaut et la note d’intention', async () => {
    const game = await aliceGame()
    const response = await api(alice, 'GET', `/api/games/${game.id}/registration-form`)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      version: null,
      definition: definition(),
      game: { noteIntention: 'Jeu sombre, consentement et sécurité émotionnelle.' }
    })
  })

  it('chaque modification crée une version ; un enregistrement identique n’en crée pas', async () => {
    const game = await aliceGame()

    const first = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, definition())
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect((first.body as any).version.number).toBe(1)

    const same = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, definition())
    expect((same.body as any).version.number).toBe(1)

    const changed = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, definition({ facebookName: { asked: true, required: false } }))
    expect((changed.body as any).version.number).toBe(2)
    expect((changed.body as any).definition.standardFields.facebookName).toEqual({ asked: true, required: false })

    // Les versions précédentes restent intactes (R9)
    const versions = await prisma.registrationFormVersion.findMany({ where: { form: { gameId: game.id } }, orderBy: { number: 'asc' } })
    expect(versions.map((version) => (version.definition as any).standardFields.facebookName.asked)).toEqual([false, true])
  })

  it('un champ non demandé est enregistré comme facultatif', async () => {
    const game = await aliceGame()
    const response = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, definition({ phone: { asked: false, required: true } }))

    expect((response.body as any).definition.standardFields.phone).toEqual({ asked: false, required: false })
  })

  it('refuse une définition incomplète', async () => {
    const game = await aliceGame()
    const response = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, { standardFields: { phone: { asked: true, required: true } } })
    expect(response.status).toBe(400)
  })

  it('une co-organisatrice peut régler le formulaire du jeu partagé', async () => {
    const { b } = world
    const response = await api(carol, 'PUT', `/api/games/${b.game.id}/registration-form`, definition())
    expect(response.status).toBe(200)
  })

  it('la suppression du jeu emporte son formulaire et ses versions', async () => {
    const game = await aliceGame()
    await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, definition())

    expect((await api(alice, 'DELETE', `/api/games/${game.id}`)).status).toBe(200)
    expect(await prisma.registrationForm.count({ where: { gameId: game.id } })).toBe(0)
    expect(await prisma.registrationFormVersion.count({ where: { form: { gameId: game.id } } })).toBe(0)
  })
})
