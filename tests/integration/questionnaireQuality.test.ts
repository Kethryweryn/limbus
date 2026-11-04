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
    // US-135 : les personnages PJ, avec leurs factions, pour l'essai du questionnaire ; ni PNJ ni relations
    expect(quality.characters).toEqual([
      { id: aldric!.id, name: 'Aldric', factions: [{ id: loups.id, name: 'Loups' }], intrigues: [] },
      { id: bertrand!.id, name: 'Bertrand', factions: [{ id: loups.id, name: 'Loups' }], intrigues: [] },
      { id: expect.any(String), name: 'Cyrielle', factions: [], intrigues: [] }
    ])
    expect(quality.findings).toEqual([
      { kind: 'characterWithoutLink', level: 'review', character: { id: expect.any(String), name: 'Cyrielle' } },
      expect.objectContaining({ kind: 'indistinctCharacters', characters: [{ id: aldric!.id, name: 'Aldric' }, { id: bertrand!.id, name: 'Bertrand' }], similarity: 1, separating: null }),
      { kind: 'optionWithoutLink', level: 'watch', questionId: style!.id, questionLabel: 'Ton style', option: 'Combat' }
    ])
    expect(quality.respondentCount).toBe(0)
    expect(quality.estimate).toBeNull()
  })
})

// EPIC-039 et EPIC-040 : repères sur les réponses reçues et estimation générale (US-136 à US-140)
describe('repères sur les réponses reçues', () => {
  it('compte chaque personne une fois, ne juge que les questions reliées et ne nomme personne', async () => {
    const key = `reponses-${Date.now()}`
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const aldric = await prisma.character.create({ data: { name: 'Aldric', slug: `${key}-aldric`, gameId: game.id } })
    const form = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, {
      standardFields,
      questions: [
        { label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] },
        { label: 'Viens-tu en voiture ?', type: 'single', required: false, options: ['Oui', 'Non'] }
      ]
    })
    expect(form.status, JSON.stringify(form.body)).toBe(200)
    const [style, car] = bodyOf<ApiResponse<'/api/games/:id/registration-form', 'put'>>(form).definition.questions
    const links = await api(alice, 'PUT', `/api/games/${game.id}/registration-question-links`, { links: [{ questionId: style!.id, option: 'Intrigue', characterId: aldric.id }] })
    expect(links.status, JSON.stringify(links.body)).toBe(200)

    const [first, second] = await Promise.all(['premiere', 'seconde'].map((name) => prisma.registrationPeriod.create({ data: { gameId: game.id, name, publicId: `${key}-${name}`, entryMode: 'form' } })))
    const people = await Promise.all(['Zoe', 'Ines', 'Leo', 'Hugo'].map((name) => prisma.participant.create({
      data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
    })))
    const register = (periodId: string, person: { id: string, email: string | null }, answers: Record<string, string>, createdAt: Date) => prisma.registration.create({
      data: { periodId, participantId: person.id, status: 'received', source: 'form', email: person.email!, questionAnswers: answers, createdAt }
    })
    const [zoe] = people
    await Promise.all(people.map((person) => register(second!.id, person, { [style!.id]: 'Intrigue', [car!.id]: 'Oui' }, new Date('2026-02-01'))))
    // L'ancienne inscription de Zoé ne compte pas
    await register(first!.id, zoe!, { [style!.id]: 'Combat' }, new Date('2026-01-01'))

    const response = await api(alice, 'GET', `/api/games/${game.id}/registration-form-quality`)
    expect(response.status).toBe(200)
    const quality = bodyOf<Quality>(response)
    expect(quality.respondentCount).toBe(4)
    // US-140 : un seul rôle pour quatre personnes, trois restent sans rôle
    expect(quality.estimate).toMatchObject({ level: 'good', withoutRole: 3, withoutPoints: 0, note: { level: 'good', value: 1, counted: 1 }, ties: { level: 'good', count: 0, total: 4 } })
    expect(quality.findings).toContainEqual(expect.objectContaining({ kind: 'dominantAnswer', level: 'unsure', questionId: style!.id, option: 'Intrigue', count: 4, total: 4 }))
    expect(quality.findings).toContainEqual({ kind: 'overWanted', level: 'watch', character: { id: aldric.id, name: 'Aldric' }, count: 4, respondents: 4 })
    // La question d'organisation, sans lien, n'a que son repère de lien
    expect(quality.findings.filter((finding) => 'questionId' in finding && finding.questionId === car!.id).map((finding) => finding.kind)).toEqual(['questionWithoutLink'])
    expect(JSON.stringify(quality)).not.toContain(key)
  })
})
