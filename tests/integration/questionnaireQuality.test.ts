// EPIC-037 : repères sur les liens du questionnaire (US-133, US-134)
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf } from './api'
import { createTestPrisma } from './db'

const prisma = createTestPrisma()
const { alice } = inject('world').users

afterAll(async () => {
  await prisma.$disconnect()
})

type Quality = ApiResponse<'/api/games/:id/registration-form-quality'>
const off = { asked: false, required: false }
const standardFields = { lastName: off, firstName: off, facebookName: off, phone: off, emergencyContact: off, dietary: off }

describe('repères sur les liens du questionnaire', () => {
  it('signale le personnage sans lien, l’option sans lien et les personnages indistincts ; ignore les PNJ', async () => {
    const key = `qualite-${Date.now()}`
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const loups = await prisma.faction.create({ data: { name: 'Loups', slug: `${key}-loups`, gameId: game.id } })
    const [aldric, bertrand] = await Promise.all(['Aldric', 'Bertrand'].map((name) => prisma.character.create({
      data: { name, slug: `${key}-${name.toLowerCase()}`, gameId: game.id, factions: { connect: { id: loups.id } } }
    })))
    await prisma.character.create({ data: { name: 'Cyrielle', slug: `${key}-cyrielle`, gameId: game.id } })
    await prisma.character.create({ data: { name: 'Garde', slug: `${key}-garde`, gameId: game.id, type: 'pnj' } })
    const form = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, {
      standardFields,
      questions: [{ label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] }]
    })
    expect(form.status, JSON.stringify(form.body)).toBe(200)
    const [style] = bodyOf<ApiResponse<'/api/games/:id/registration-form', 'put'>>(form).definition.questions
    const links = await api(alice, 'PUT', `/api/games/${game.id}/registration-question-links`, { links: [{ questionId: style!.id, option: 'Intrigue', factionId: loups.id }] })
    expect(links.status, JSON.stringify(links.body)).toBe(200)

    const response = await api(alice, 'GET', `/api/games/${game.id}/registration-form-quality`)
    expect(response.status).toBe(200)
    const quality = bodyOf<Quality>(response)
    expect(quality).toMatchObject({ characterCount: 3, questionCount: 1 })
    expect(quality.findings).toEqual([
      { kind: 'characterWithoutLink', level: 'review', character: { id: expect.any(String), name: 'Cyrielle' } },
      expect.objectContaining({ kind: 'indistinctCharacters', characters: [{ id: aldric!.id, name: 'Aldric' }, { id: bertrand!.id, name: 'Bertrand' }], similarity: 1, separating: null }),
      { kind: 'optionWithoutLink', level: 'watch', questionId: style!.id, questionLabel: 'Ton style', option: 'Combat' }
    ])
  })
})
