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
      data: { name, slug: `${key}-${name.toLowerCase()}`, gameId: game.id, factionLinks: { create: { factionId: loups.id } } }
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

// EPIC-042 : relecture des questions et mélange des options (US-144, US-146)
describe('relecture et mélange', () => {
  it('rend les signalements du formulaire enregistré, et le mélange crée une version', async () => {
    const key = `redaction-${Date.now()}`
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const route = `/api/games/${game.id}/registration-form`
    const question = { label: 'Combat ou intrigue ?', type: 'single', required: false, options: ['Combat', 'Intrigue'] }
    const first = await api(alice, 'PUT', route, { standardFields, questions: [question] })
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    const saved = bodyOf<ApiResponse<'/api/games/:id/registration-form', 'put'>>(first).definition.questions[0]!
    expect(saved).not.toHaveProperty('shuffleOptions')

    const quality = bodyOf<Quality>(await api(alice, 'GET', `/api/games/${game.id}/registration-form-quality`))
    expect(quality.drafting).toEqual({
      questions: [{ questionId: saved.id, label: 'Combat ou intrigue ?', flags: [{ rule: 'doubleBarreled', places: [{ word: 'ou', option: null }] }] }],
      wordCounts: [{ label: 'Combat ou intrigue ?', words: 3 }]
    })
    expect(quality.hasAnswers).toBe(false)

    // Réenregistrer sans changement ne crée pas de version ; cocher le mélange en crée une
    const versions = () => prisma.registrationFormVersion.count({ where: { form: { gameId: game.id } } })
    expect((await api(alice, 'PUT', route, { standardFields, questions: [{ ...question, id: saved.id, shuffleOptions: false }] })).status).toBe(200)
    expect(await versions()).toBe(1)
    const shuffled = await api(alice, 'PUT', route, { standardFields, questions: [{ ...question, id: saved.id, shuffleOptions: true }] })
    expect(shuffled.status, JSON.stringify(shuffled.body)).toBe(200)
    expect(await versions()).toBe(2)
    expect(bodyOf<ApiResponse<'/api/games/:id/registration-form', 'put'>>(shuffled).definition.questions[0]!.shuffleOptions).toBe(true)
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

    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: key } })
    const people = await Promise.all(['Zoe', 'Ines', 'Leo', 'Hugo'].map((name) => prisma.participant.create({
      data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
    })))
    const register = (person: { id: string, email: string | null }, answers: Record<string, string>) => prisma.registration.create({
      data: { periodId: period.id, participantId: person.id, status: 'received', source: 'form', email: person.email!, questionAnswers: answers }
    })
    await Promise.all(people.map((person) => register(person, { [style!.id]: 'Intrigue', [car!.id]: 'Oui' })))

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

// EPIC-041 : proportions attendues des options (US-141), et ce que la route de l'encadré rend pour la prévision (US-142)
describe('proportions attendues des options', () => {
  type Expectations = ApiResponse<'/api/games/:id/registration-option-expectations'>

  it('les enregistre hors des versions, refuse le reste, contrôle la version, et les copie avec le jeu', async () => {
    const key = `proportions-${Date.now()}`
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const aldric = await prisma.character.create({ data: { name: 'Aldric', slug: `${key}-aldric`, gameId: game.id } })
    const form = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, {
      standardFields,
      questions: [
        { label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] },
        { label: 'Ton envie', type: 'scale', required: false },
        { label: 'Tes goûts', type: 'multiple', required: false, options: ['Romance', 'Trahison'] }
      ]
    })
    expect(form.status, JSON.stringify(form.body)).toBe(200)
    const formBody = bodyOf<ApiResponse<'/api/games/:id/registration-form', 'put'>>(form)
    const [style, envie, gouts] = formBody.definition.questions
    const route = `/api/games/${game.id}/registration-option-expectations`
    const read = async () => bodyOf<Expectations>(await api(alice, 'GET', route))

    expect(await read()).toEqual({ expectations: [], version: null })

    // Refus : une option inconnue, un niveau hors de l'échelle, une part hors bornes, des parts toutes nulles
    expect((await api(alice, 'PUT', route, { expectations: [{ questionId: style!.id, option: 'Disparue', share: 0.5 }] })).status).toBe(400)
    expect((await api(alice, 'PUT', route, { expectations: [{ questionId: envie!.id, option: '6', share: 0.5 }] })).status).toBe(400)
    expect((await api(alice, 'PUT', route, { expectations: [{ questionId: style!.id, option: 'Intrigue', share: 1.2 }] })).status).toBe(400)
    expect((await api(alice, 'PUT', route, { expectations: [{ questionId: style!.id, option: 'Intrigue', share: 0 }] })).status).toBe(400)
    expect((await api(alice, 'PUT', route, { expectations: [{ questionId: envie!.id, option: '3', share: 0 }] })).status).toBe(400)

    const rows = [
      { questionId: style!.id, option: 'Intrigue', share: 0.7 },
      { questionId: style!.id, option: 'Combat', share: 0.3 },
      { questionId: envie!.id, option: '3', share: 1 },
      // Une question à choix multiples peut n'avoir que des parts nulles : personne ne coche
      { questionId: gouts!.id, option: 'Romance', share: 0 }
    ]
    const sent = await api(alice, 'PUT', route, { expectations: rows }, { headers: { 'if-unmodified-since': new Date(0).toISOString() } })
    expect(sent.status, JSON.stringify(sent.body)).toBe(200)
    const saved = bodyOf<Expectations>(sent)
    expect(saved.expectations).toHaveLength(4)
    expect(saved.version).not.toBeNull()
    expect(await read()).toEqual(saved)
    // Sans nouvelle version du formulaire
    const current = bodyOf<ApiResponse<'/api/games/:id/registration-form'>>(await api(alice, 'GET', `/api/games/${game.id}/registration-form`))
    expect(current.version?.number).toBe(formBody.version?.number)

    // Une version lue périmée : conflit, et rien n'est écrit
    const stale = await api(alice, 'PUT', route, { expectations: [rows[0]] }, { headers: { 'if-unmodified-since': new Date(0).toISOString() } })
    expect(stale.status).toBe(409)
    expect((await read()).expectations).toHaveLength(4)
    const fresh = await api(alice, 'PUT', route, { expectations: rows.slice(0, 3) }, { headers: { 'if-unmodified-since': saved.version! } })
    expect(fresh.status, JSON.stringify(fresh.body)).toBe(200)

    // Quelqu'un vide la liste : une version lue avant ne l'écrase pas sans le savoir, et une liste vide se réécrit depuis NO_VERSION
    const readBefore = bodyOf<Expectations>(fresh).version!
    const cleared = await api(alice, 'PUT', route, { expectations: [] }, { headers: { 'if-unmodified-since': readBefore } })
    expect(bodyOf<Expectations>(cleared)).toEqual({ expectations: [], version: null })
    expect((await api(alice, 'PUT', route, { expectations: rows.slice(0, 3) }, { headers: { 'if-unmodified-since': readBefore } })).status).toBe(409)
    const rewritten = await api(alice, 'PUT', route, { expectations: rows.slice(0, 3) }, { headers: { 'if-unmodified-since': new Date(0).toISOString() } })
    expect(rewritten.status, JSON.stringify(rewritten.body)).toBe(200)

    // La route de l'encadré rend ce que la prévision calcule
    const links = await api(alice, 'PUT', `/api/games/${game.id}/registration-question-links`, { links: [{ questionId: style!.id, option: 'Intrigue', characterId: aldric.id }] })
    expect(links.status).toBe(200)
    const quality = bodyOf<Quality>(await api(alice, 'GET', `/api/games/${game.id}/registration-form-quality`))
    expect(quality.forecastInput.questions.map(({ id }) => id)).toEqual([style!.id, envie!.id, gouts!.id])
    expect(quality.forecastInput.links).toEqual([{ questionId: style!.id, option: 'Intrigue', target: { kind: 'character', id: aldric.id, name: 'Aldric' } }])
    expect(quality.forecastInput.expectations).toHaveLength(3)

    // La copie du jeu les emporte
    const copied = await api(alice, 'POST', `/api/games/${game.id}/bequests`, { email: 'bob@example.test' })
    expect(copied.status, JSON.stringify(copied.body)).toBe(200)
    const copy = await prisma.game.findFirstOrThrow({ where: { copiedFromGameId: game.id }, include: { registrationOptionExpectations: true } })
    expect(copy.registrationOptionExpectations).toHaveLength(3)

    // Une option retirée du formulaire : sa ligne est ignorée à la lecture
    await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, {
      standardFields,
      questions: [{ id: style!.id, label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Diplomatie'] }]
    })
    expect((await read()).expectations).toEqual([{ questionId: style!.id, option: 'Intrigue', share: 0.7 }])
  })
})
