// EPIC-019 : questions propres au jeu (US-081) et affinités (US-082) du formulaire d'inscription
import { createHash, randomBytes } from 'node:crypto'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'

const { alice, bob } = inject('world').users
const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

async function publicApi(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { 'x-forwarded-for': `10.19.0.${counter}` }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(`${inject('baseUrl')}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await response.text()
  let parsed: unknown = text
  try { parsed = JSON.parse(text) } catch { /* texte brut */ }
  return { status: response.status, body: parsed as any }
}

const standardFields = {
  lastName: { asked: true, required: false },
  firstName: { asked: true, required: false },
  facebookName: { asked: false, required: false },
  phone: { asked: false, required: false },
  emergencyContact: { asked: false, required: false },
  dietary: { asked: false, required: false }
}
const affinities = {
  wantWith: { asked: true, required: true },
  notWith: { asked: true, required: false },
  refusedRelations: { asked: false, required: false },
  avoid: { asked: true, required: false }
}
const questions = [
  { label: 'Pourquoi ce jeu ?', type: 'text', required: true, options: [] },
  { label: 'Ton style', type: 'single', required: true, options: ['Combat', 'Intrigue'] },
  { label: 'Tes envies', type: 'multiple', required: false, options: ['Romance', 'Trahison', 'Mystère'] },
  { label: 'Ton expérience', type: 'scale', required: false, options: [] }
]

// Un jeu d'Alice avec ce formulaire, et une invitation dont le test connaît le jeton
async function invitedWithForm() {
  const key = `questions-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id, noteIntention: 'Note' } })
  const saved = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, { standardFields, affinities, questions })
  expect(saved.status, JSON.stringify(saved.body)).toBe(200)
  const definition = (saved.body as any).definition
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-03-10T09:00:00Z') } })
  const period = await prisma.registrationPeriod.create({
    data: { name: `Période ${key}`, gameId: game.id, publicId: `pub-${key}`, state: 'open', sessions: { create: { sessionId: session.id, seats: 5 } } }
  })
  const participant = await prisma.participant.create({ data: { name: `Camille ${key}`, slug: `camille-${key}`, email: `camille-${key}@example.test`, gameLinks: { create: { gameId: game.id } } } })
  const token = randomBytes(32).toString('base64url')
  const registration = await prisma.registration.create({
    data: {
      periodId: period.id, sessionId: session.id, participantId: participant.id, status: 'invited', source: 'invitation',
      invitedById: alice.id, email: participant.email!, tokenHash: sha256(token), responseDueAt: new Date(Date.now() + 7 * 86_400_000)
    }
  })
  const [text, single, multiple, scale] = definition.questions as Array<{ id: string }>
  return { game, participant, registration, path: `/api/public/registrations/${token}`, definition, ids: { text: text!.id, single: single!.id, multiple: multiple!.id, scale: scale!.id } }
}

const body = (ids: { text: string, single: string, multiple: string, scale: string }, extra: Record<string, unknown> = {}) => ({
  email: `reponse-${counter}@example.test`,
  firstName: 'Camille',
  charterAccepted: true,
  affinities: { wantWith: ['Léa', '', ' Noé '], notWith: [], avoid: ['Max'], refusedRelations: ['ignorée'] },
  questionAnswers: { [ids.text]: 'Pour l’ambiance', [ids.single]: 'Intrigue', [ids.multiple]: ['Romance', 'Mystère'], [ids.scale]: 4, inconnue: 'ignorée' },
  ...extra
})

describe('éditeur du formulaire (US-081, US-082)', () => {
  it('attribue un identifiant à chaque nouvelle question et le garde d’une version à l’autre', async () => {
    const { game, definition } = await invitedWithForm()
    expect(definition.affinities).toEqual(affinities)
    expect(definition.questions.map((question: { id: string }) => question.id).every(Boolean)).toBe(true)
    expect(definition.questions[2].options).toEqual(['Romance', 'Trahison', 'Mystère'])

    const renamed = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, {
      standardFields, affinities, questions: [{ ...definition.questions[0], label: 'Pourquoi venir ?' }, ...definition.questions.slice(1)]
    })
    expect((renamed.body as any).version.number).toBe(2)
    expect((renamed.body as any).definition.questions[0].id).toBe(definition.questions[0].id)
  })

  it('refuse une question à choix sans deux options, ou un identifiant en double', async () => {
    const { game, definition } = await invitedWithForm()
    const oneOption = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, { standardFields, questions: [{ label: 'Choix', type: 'single', options: ['Seule'] }] })
    expect(oneOption.status).toBe(400)
    const twice = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, { standardFields, questions: [definition.questions[0], definition.questions[0]] })
    expect(twice.status).toBe(400)
  })
})

describe('répondre aux questions et aux affinités (US-081, US-082)', () => {
  it('enregistre les réponses et une affinité par ligne ; l’équipe les lit, pas une autre équipe', async () => {
    const { registration, path, participant, ids } = await invitedWithForm()
    const saved = await publicApi('PUT', path, body(ids))
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(saved.body.answers.affinities).toEqual({ wantWith: ['Léa', 'Noé'], notWith: [], refusedRelations: [], avoid: ['Max'] })
    expect(saved.body.answers.questionAnswers).toEqual({ [ids.text]: 'Pour l’ambiance', [ids.single]: 'Intrigue', [ids.multiple]: ['Romance', 'Mystère'], [ids.scale]: 4 })
    expect(await prisma.registrationAffinity.count({ where: { registrationId: registration.id } })).toBe(3)

    const detail = await api(alice, 'GET', `/api/registrations/${registration.id}`)
    expect(detail.body).toMatchObject({
      questions: [{ id: ids.text, label: 'Pourquoi ce jeu ?' }, {}, {}, {}],
      questionAnswers: { [ids.single]: 'Intrigue' },
      affinities: { wantWith: ['Léa', 'Noé'], avoid: ['Max'] }
    })
    expect([403, 404]).toContain((await api(bob, 'GET', `/api/registrations/${registration.id}`)).status)

    const exported = await api(alice, 'GET', `/api/participants/${participant.id}/export`)
    expect(JSON.stringify(exported.body)).toContain('Pour l’ambiance')
    expect(JSON.stringify(exported.body)).toContain('Noé')

    // Une modification remplace les affinités
    const edited = await publicApi('PUT', path, body(ids, { affinities: { wantWith: ['Zoé'] } }))
    expect(edited.status, JSON.stringify(edited.body)).toBe(200)
    expect(await prisma.registrationAffinity.findMany({ where: { registrationId: registration.id }, select: { kind: true, text: true } })).toEqual([{ kind: 'wantWith', text: 'Zoé' }])
  })

  it('refuse une réponse obligatoire manquante ou une option inconnue, sous le bon champ', async () => {
    const { path, ids } = await invitedWithForm()
    const missing = await publicApi('PUT', path, body(ids, { questionAnswers: { [ids.single]: 'Intrigue' }, affinities: { wantWith: [''] } }))
    expect(missing.status).toBe(400)
    const paths = (missing.body.data.data as Array<{ path: string }>).map((issue) => issue.path)
    expect(paths).toEqual(expect.arrayContaining([`questionAnswers.${ids.text}`, 'affinities.wantWith']))

    const unknown = await publicApi('PUT', path, body(ids, { questionAnswers: { [ids.text]: 'Oui', [ids.single]: 'Autre' } }))
    expect(unknown.status).toBe(400)
    expect(JSON.stringify(unknown.body)).toContain('option inconnue')
  })

  it('l’inscription garde sa version du formulaire (R9)', async () => {
    const { game, path, ids, definition } = await invitedWithForm()
    expect((await publicApi('PUT', path, body(ids))).status).toBe(200)
    await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, { standardFields, affinities, questions: [{ ...definition.questions[0], label: 'Nouvelle question' }] })

    const read = await publicApi('GET', path)
    expect(read.body.definition.questions.map((question: { label: string }) => question.label)).toEqual(questions.map((question) => question.label))
    expect(read.body.answers.questionAnswers[ids.scale]).toBe(4)
  })
})
