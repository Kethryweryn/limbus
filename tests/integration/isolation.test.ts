// Isolation entre jeux : Alice (propriétaire du jeu A) ne doit rien pouvoir lire, modifier ou
// supprimer dans le jeu B de Bob. Chaque refus est accompagné d'un témoin : la même requête
// sur les données d'Alice réussit, ce qui prouve que le refus vient bien du contrôle d'accès.
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api, DENIED } from './api'
import { createTestPrisma } from './db'
import type { GameWorld } from './fixtures'

const world = inject('world')
const { alice, carol, admin } = world.users
const { a, b } = world
const prisma = createTestPrisma()

afterAll(async () => {
  await prisma.$disconnect()
})

type Resource = {
  path: string
  model: 'character' | 'faction' | 'intrigue' | 'item' | 'location' | 'document' | 'timelineEvent' | 'participant' | 'session' | 'game' | 'registrationPeriod'
  entity: (w: GameWorld) => { id: string, slug?: string }
  // Corps valide pour une mise à jour, rattaché au jeu donné
  body: (w: GameWorld) => Record<string, unknown>
  slugPath?: string
}

const resources: Resource[] = [
  { path: 'games', model: 'game', entity: (w) => w.game, body: () => ({ title: 'Renommé' }), slugPath: 'games/slug' },
  { path: 'characters', model: 'character', entity: (w) => w.character, body: () => ({ name: 'Renommé' }), slugPath: 'characters/slug' },
  { path: 'factions', model: 'faction', entity: (w) => w.faction, body: (w) => ({ name: 'Renommé', gameId: w.game.id }), slugPath: 'factions/slug' },
  { path: 'intrigues', model: 'intrigue', entity: (w) => w.intrigue, body: (w) => ({ name: 'Renommé', gameId: w.game.id }), slugPath: 'intrigues/slug' },
  { path: 'items', model: 'item', entity: (w) => w.item, body: (w) => ({ name: 'Renommé', gameId: w.game.id }) },
  { path: 'locations', model: 'location', entity: (w) => w.location, body: (w) => ({ name: 'Renommé', gameId: w.game.id }) },
  { path: 'documents', model: 'document', entity: (w) => w.document, body: (w) => ({ title: 'Renommé', content: 'x', gameId: w.game.id }) },
  { path: 'timeline-events', model: 'timelineEvent', entity: (w) => w.timelineEvent, body: (w) => ({ name: 'Renommé', day: 1, time: '11:00', gameId: w.game.id }) },
  { path: 'participants', model: 'participant', entity: (w) => w.participant, body: (w) => ({ name: 'Renommé', gameIds: [w.game.id] }) },
  { path: 'sessions', model: 'session', entity: (w) => w.session, body: (w) => ({ name: 'Renommé', gameId: w.game.id }) },
  {
    path: 'registration-periods',
    model: 'registrationPeriod',
    entity: (w) => w.registrationPeriod,
    body: (w) => ({ name: 'Renommé', gameId: w.game.id, sessions: [{ sessionId: w.session.id, seats: 10 }] })
  }
]

async function exists(model: Resource['model'], id: string) {
  return Boolean(await (prisma[model] as any).findUnique({ where: { id }, select: { id: true } }))
}

function ids(body: unknown): string[] {
  return JSON.stringify(body).match(/"id":"([^"]+)"/g)?.map((match) => match.slice(6, -1)) || []
}

describe.each(resources)('/api/$path', (resource) => {
  const own = resource.entity(a)
  const foreign = resource.entity(b)

  it('lecture : refusée chez Bob, autorisée chez soi', async () => {
    expect((await api(alice, 'GET', `/api/${resource.path}/${own.id}`)).status).toBe(200)
    expect(DENIED).toContain((await api(alice, 'GET', `/api/${resource.path}/${foreign.id}`)).status)
  })

  it.runIf(resource.slugPath)('lecture par slug : refusée chez Bob', async () => {
    expect((await api(alice, 'GET', `/api/${resource.slugPath}/${own.slug}`)).status).toBe(200)
    expect(DENIED).toContain((await api(alice, 'GET', `/api/${resource.slugPath}/${foreign.slug}`)).status)
  })

  it('liste : ne contient que les données accessibles', async () => {
    const response = await api(alice, 'GET', `/api/${resource.path}`)
    expect(response.status).toBe(200)
    expect(ids(response.body)).toContain(own.id)
    expect(ids(response.body)).not.toContain(foreign.id)
  })

  it('modification : refusée chez Bob, même avec un corps valide', async () => {
    expect(DENIED).toContain((await api(alice, 'PUT', `/api/${resource.path}/${foreign.id}`, resource.body(b))).status)
    expect(DENIED).toContain((await api(alice, 'PUT', `/api/${resource.path}/${foreign.id}`, resource.body(a))).status)
    const unchanged = await (prisma[resource.model] as any).findUnique({ where: { id: foreign.id } })
    expect(unchanged.name ?? unchanged.title).not.toBe('Renommé')

    expect((await api(alice, 'PUT', `/api/${resource.path}/${own.id}`, resource.body(a))).status).toBe(200)
  })

  it('suppression : refusée chez Bob', async () => {
    expect(DENIED).toContain((await api(alice, 'DELETE', `/api/${resource.path}/${foreign.id}`)).status)
    expect(await exists(resource.model, foreign.id)).toBe(true)
  })

  it('accès par une co-organisatrice du jeu de Bob', async () => {
    expect((await api(carol, 'GET', `/api/${resource.path}/${foreign.id}`)).status).toBe(200)
  })
})

describe('création dans un jeu inaccessible', () => {
  const creations: Array<[string, Record<string, unknown>]> = [
    ['characters', { name: 'Intrus', gameId: b.game.id }],
    ['factions', { name: 'Intrus', gameId: b.game.id }],
    ['intrigues', { name: 'Intrus', gameId: b.game.id }],
    ['items', { name: 'Intrus', gameId: b.game.id }],
    ['locations', { name: 'Intrus', gameId: b.game.id }],
    ['documents', { title: 'Intrus', content: 'x', gameId: b.game.id }],
    ['timeline-events', { name: 'Intrus', day: 1, time: '10:00', gameId: b.game.id }],
    ['sessions', { name: 'Intrus', gameId: b.game.id }],
    ['participants', { name: 'Intrus', gameIds: [b.game.id] }],
    ['registration-periods', { name: 'Intrus', gameId: b.game.id, sessions: [{ sessionId: b.session.id }] }]
  ]

  it.each(creations)('POST /api/%s refusé', async (path, body) => {
    expect(DENIED).toContain((await api(alice, 'POST', `/api/${path}`, body)).status)
  })

  it('déplacer sa propre ressource vers le jeu de Bob est refusé', async () => {
    // Refus avant même le contrôle d'accès : une ressource ne change jamais de jeu
    expect([400, ...DENIED]).toContain((await api(alice, 'PUT', `/api/characters/${a.character.id}`, { gameId: b.game.id })).status)
    const character = await prisma.character.findUnique({ where: { id: a.character.id } })
    expect(character?.gameId).toBe(a.game.id)
  })
})

describe('références croisées vers le jeu de Bob', () => {
  // Une ressource du jeu A ne doit pas pouvoir pointer vers des entités du jeu B
  const references: Array<[string, string, Record<string, unknown>]> = [
    ['POST', '/api/characters', { name: 'X', gameId: a.game.id, factionIds: [b.faction.id] }],
    ['POST', '/api/factions', { name: 'X', gameId: a.game.id, characterIds: [b.character.id] }],
    ['POST', '/api/intrigues', { name: 'X', gameId: a.game.id, characterIds: [b.character.id] }],
    ['POST', '/api/intrigues', { name: 'X', gameId: a.game.id, factionIds: [b.faction.id] }],
    ['POST', '/api/items', { name: 'X', gameId: a.game.id, characterIds: [b.character.id] }],
    ['POST', '/api/items', { name: 'X', gameId: a.game.id, intrigueIds: [b.intrigue.id] }],
    ['POST', '/api/items', { name: 'X', gameId: a.game.id, locationCharacterId: b.character.id }],
    ['POST', '/api/documents', { title: 'X', content: 'x', gameId: a.game.id, characterId: b.character.id }],
    ['POST', '/api/documents', { title: 'X', content: 'x', gameId: a.game.id, characterIds: [b.character.id] }],
    ['POST', '/api/documents', { title: 'X', content: 'x', gameId: a.game.id, factionIds: [b.faction.id] }],
    ['POST', '/api/timeline-events', { name: 'X', day: 1, time: '10:00', gameId: a.game.id, characterIds: [b.character.id] }],
    ['POST', '/api/timeline-events', { name: 'X', day: 1, time: '10:00', gameId: a.game.id, factionIds: [b.faction.id] }],
    ['POST', '/api/timeline-events', { name: 'X', day: 1, time: '10:00', gameId: a.game.id, intrigueIds: [b.intrigue.id] }],
    ['POST', '/api/timeline-events', { name: 'X', day: 1, time: '10:00', gameId: a.game.id, itemIds: [b.item.id] }],
    ['POST', '/api/sessions', { name: 'X', gameId: a.game.id, locationId: b.location.id }],
    ['POST', '/api/sessions', { name: 'X', gameId: a.game.id, assignments: [{ characterId: b.character.id }] }],
    ['POST', '/api/sessions', { name: 'X', gameId: a.game.id, participants: [{ participantId: b.participant.id, role: 'participant' }] }],
    ['PUT', `/api/sessions/${a.session.id}/timeline`, { assignments: [{ timelineEventId: b.timelineEvent.id, participantIds: [] }] }],
    ['PUT', `/api/sessions/${a.session.id}/timeline`, { assignments: [{ timelineEventId: a.timelineEvent.id, participantIds: [b.participant.id] }] }],
    ['PUT', `/api/characters/${a.character.id}/trombinoscope`, { entries: [{ targetCharacterId: b.character.id, included: true, faceKnown: true }] }],
    ['POST', '/api/registration-periods', { name: 'X', gameId: a.game.id, sessions: [{ sessionId: b.session.id }] }],
    ['POST', '/api/characters', { name: 'X', gameId: a.game.id, trombinoscopePhotoUrl: b.photo.url }],
    ['POST', '/api/sessions', { name: 'X', gameId: a.game.id, assignments: [{ characterId: a.character.id, photoUrl: b.photo.url }] }],
    ['PUT', `/api/sessions/${a.session.id}/payments/settings`, { paymentRibUrl: b.rib.url }],
    ['PUT', `/api/sessions/${a.session.id}`, { name: 'X', gameId: a.game.id, assignments: [{ characterId: a.character.id, photoUrl: b.photo.url }] }],
    ['PUT', `/api/registration-periods/${a.registrationPeriod.id}`, { name: 'X', gameId: a.game.id, sessions: [{ sessionId: b.session.id }] }],
    ['PUT', `/api/registration-periods/${a.registrationPeriod.id}`, { name: 'X', gameId: b.game.id, sessions: [{ sessionId: b.session.id }] }]
  ]

  it.each(references)('%s %s %j est rejeté', async (method, path, body) => {
    const response = await api(alice, method, path, body)
    expect(response.status, JSON.stringify(response.body)).toBeGreaterThanOrEqual(400)
  })
})

describe('sous-routes de session et de jeu chez Bob', () => {
  const session = b.session.id
  const denied: Array<[string, string, unknown?]> = [
    ['GET', `/api/sessions/${session}/documents`],
    ['GET', `/api/sessions/${session}/documents/${b.document.id}/pdf`],
    ['GET', `/api/sessions/${session}/documents/character-sheets/${b.character.id}/pdf`],
    ['POST', `/api/sessions/${session}/documents/send`, { documentIds: [b.document.id] }],
    ['POST', `/api/sessions/${session}/documents/send-character-sheets`, {}],
    ['POST', `/api/sessions/${session}/documents/send-trombinoscopes`, {}],
    ['POST', `/api/sessions/${session}/documents/send-character-sheets-and-trombinoscopes`, {}],
    ['POST', `/api/sessions/${session}/documents/resend`, { kind: 'document', documentId: b.document.id }],
    ['POST', `/api/sessions/${session}/documents/test-email`, { emails: ['x@example.test'] }],
    ['POST', `/api/sessions/${session}/documents/test-character-sheet`, { emails: ['x@example.test'], characterId: b.character.id }],
    ['GET', `/api/sessions/${session}/payments`],
    ['PUT', `/api/sessions/${session}/payments/settings`, { paymentLinkUrl: 'https://example.test' }],
    ['PUT', `/api/sessions/${session}/payments/${b.participant.id}`, { paid: true }],
    ['PUT', `/api/sessions/${session}/payments/${b.participant.id}/refund`, { status: 'to_refund' }],
    ['POST', `/api/sessions/${session}/tariffs`, { name: 'Intrus', amount: 10 }],
    ['PUT', `/api/sessions/${session}/tariffs/${b.tariff.id}`, { name: 'Intrus', amount: 10 }],
    ['DELETE', `/api/sessions/${session}/tariffs/${b.tariff.id}`],
    ['PUT', `/api/sessions/${session}/payments/${b.participant.id}/tariff`, { tariffId: null }],
    ['PUT', `/api/sessions/${session}/payments/${b.participant.id}/departure`, { status: 'kept' }],
    ['PUT', `/api/sessions/${session}/payments/${b.participant.id}/offered`, { offered: true }],
    ['POST', `/api/sessions/${session}/payments/${b.participant.id}/instalments`, { amount: 10 }],
    ['DELETE', `/api/sessions/${session}/payments/${b.participant.id}/instalments/${b.instalment.id}`],
    ['POST', `/api/sessions/${session}/payments/send`, {}],
    ['POST', `/api/sessions/${session}/payments/test-email`, { emails: ['x@example.test'] }],
    ['GET', `/api/sessions/${session}/timeline`],
    ['PUT', `/api/sessions/${session}/timeline`, { assignments: [] }],
    ['POST', `/api/sessions/${session}/postpone`, { name: 'Report intrus' }],
    ['GET', `/api/sessions/${session}/attendance`],
    ['POST', `/api/sessions/${session}/attendance/send`, { responseDueAt: new Date(Date.now() + 86_400_000).toISOString() }],
    ['POST', `/api/sessions/${session}/attendance/${b.participant.id}/remind`],
    ['POST', `/api/sessions/${session}/attendance/${b.participant.id}/resend`],
    ['POST', `/api/sessions/${session}/attendance/${b.participant.id}/extend`, { responseDueAt: new Date(Date.now() + 86_400_000).toISOString() }],
    ['POST', `/api/sessions/${session}/attendance/${b.participant.id}/release`],
    ['POST', `/api/sessions/${session}/cancellation-email`, { subject: 'Annulation', text: 'Texte' }],
    ['POST', `/api/sessions/${session}/cancellation-email/test`, { subject: 'Annulation', text: 'Texte', emails: ['x@example.test'] }],
    ['GET', `/api/sessions/${session}/trombinoscopes/${b.character.id}`],
    ['POST', `/api/sessions/${session}/trombinoscopes/generate`, {}],
    ['GET', `/api/characters/${b.character.id}/trombinoscope`],
    ['PUT', `/api/characters/${b.character.id}/trombinoscope`, { entries: [] }],
    ['GET', `/api/games/${b.game.id}/shares`],
    ['DELETE', `/api/games/${b.game.id}/shares/${carol.id}`],
    ['POST', `/api/games/${b.game.id}/transfer`, { userId: carol.id }],
    ['DELETE', `/api/games/${b.game.id}/transfer`],
    ['POST', `/api/games/${b.game.id}/transfer/accept`],
    ['POST', `/api/games/${b.game.id}/invitations`, { email: 'intrus@example.test' }],
    ['DELETE', `/api/games/${b.game.id}/invitations/${b.invitation.id}`],
    ['POST', `/api/games/${b.game.id}/bequests`, { email: 'alice@example.test' }],
    ['GET', `/api/games/${b.game.id}/bequests`],
    ['POST', `/api/games/${b.game.id}/bequests/${b.invitation.id}/resend`],
    ['DELETE', `/api/games/${b.game.id}/bequests/${b.invitation.id}`],
    ['GET', `/api/uploads/session-assignment-photos/${b.photo.filename}`],
    ['GET', `/api/uploads/session-payment-ribs/${b.rib.filename}`],
    ['GET', `/api/participants/${b.participant.id}/export`],
    ['GET', `/api/games/${b.game.id}/registration-context`],
    ['GET', `/api/games/${b.game.id}/registration-form`],
    ['POST', `/api/registration-periods/${b.registrationPeriod.id}/invitations`, { sessionId: b.session.id, participantIds: [b.participant.id] }],
    ['GET', `/api/registration-periods/${b.registrationPeriod.id}/registrations`],
    ['POST', `/api/registrations/${b.registration.id}/resend`],
    ['DELETE', `/api/registrations/${b.registration.id}`],
    ['GET', `/api/sessions/${b.session.id}/allergies`],
    ['GET', `/api/sessions/${b.session.id}/allergies/pdf`],
    ['POST', `/api/sessions/${b.session.id}/allergies/send`],
    ['GET', `/api/registrations/${b.registration.id}`],
    ['POST', `/api/registrations/${b.registration.id}/remind`],
    ['POST', `/api/registrations/${b.registration.id}/extend`, { responseDueAt: new Date(Date.now() + 86_400_000).toISOString() }],
    ['POST', `/api/registrations/${b.registration.id}/release`],
    ['POST', `/api/registrations/${b.registration.id}/withdraw`],
    ['GET', `/api/sessions/${b.session.id}/registrations/export`],
    ['PUT', `/api/games/${b.game.id}/registration-form`, {
      standardFields: Object.fromEntries(['lastName', 'firstName', 'facebookName', 'phone', 'emergencyContact', 'dietary']
        .map((key) => [key, { asked: false, required: false }]))
    }]
  ]

  it.each(denied)('%s %s est refusé', async (method, path, body) => {
    const response = await api(alice, method, path, body)
    expect(DENIED, JSON.stringify(response.body)).toContain(response.status)
  })

  it('les mêmes routes répondent chez soi (témoins)', async () => {
    expect((await api(alice, 'GET', `/api/sessions/${a.session.id}/documents`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/sessions/${a.session.id}/payments`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/sessions/${a.session.id}/timeline`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/sessions/${a.session.id}/attendance`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/characters/${a.character.id}/trombinoscope`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/games/${a.game.id}/shares`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/games/${a.game.id}/bequests`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/participants/${a.participant.id}/export`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/games/${a.game.id}/registration-context`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/games/${a.game.id}/registration-form`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/registration-periods/${a.registrationPeriod.id}/registrations`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/sessions/${a.session.id}/allergies`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/registrations/${a.registration.id}`)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/sessions/${a.session.id}/registrations/export`)).status).toBe(200)
    // Fichier référencé mais absent du disque : l'accès est accordé, puis 404
    expect((await api(alice, 'GET', `/api/uploads/session-assignment-photos/${a.photo.filename}`)).status).toBe(404)
  })

  it('les inscriptions de Bob sont intactes', async () => {
    expect(await prisma.registration.findUnique({ where: { id: b.registration.id } })).toMatchObject({ status: 'invited', tokenHash: 'hash-b', withdrawnById: null, lastRemindedAt: null })
  })

  it('inviter dans sa période un participant ou une session de Bob est refusé', async () => {
    // Période ouverte d'Alice, sur une session à elle (celle des fixtures est déjà rattachée)
    const session = await prisma.session.create({ data: { name: 'Session invitations', slug: 'session-invitations-isolation', gameId: a.game.id } })
    const period = await prisma.registrationPeriod.create({
      data: { name: 'Ouverte', gameId: a.game.id, publicId: 'isolation-ouverte', state: 'open', sessions: { create: { sessionId: session.id, seats: 5 } } }
    })
    // Participant dédié : les tests de ressources modifient celui des fixtures (email effacé)
    const own = await prisma.participant.create({
      data: { name: 'Invitée isolation', slug: 'invitee-isolation', email: 'invitee-isolation@example.test', gameLinks: { create: { gameId: a.game.id } } }
    })
    const path = `/api/registration-periods/${period.id}/invitations`

    expect((await api(alice, 'POST', path, { sessionId: session.id, participantIds: [b.participant.id] })).status).toBe(400)
    expect((await api(alice, 'POST', path, { sessionId: b.session.id, participantIds: [own.id] })).status).toBe(400)
    expect(await prisma.registration.count({ where: { participantId: b.participant.id } })).toBe(1)

    // Témoin : son propre participant, sur sa session
    const response = await api(alice, 'POST', path, { sessionId: session.id, participantIds: [own.id] })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ invitedCount: 1 })
  })

  it('la liste filtrée sur le jeu de Bob est vide', async () => {
    const response = await api(alice, 'GET', `/api/registration-periods?gameId=${b.game.id}`)
    expect(response.status).toBe(200)
    expect(response.body).toEqual([])
  })

  it('le tableau de bord ne montre pas le jeu de Bob', async () => {
    const response = await api(alice, 'GET', '/api/dashboard')
    expect(response.status).toBe(200)
    expect(JSON.stringify(response.body)).not.toContain(b.game.id)
  })
})

describe('droits de propriétaire', () => {
  it('une co-organisatrice ne peut pas supprimer le jeu', async () => {
    expect(DENIED).toContain((await api(carol, 'DELETE', `/api/games/${b.game.id}`)).status)
    expect(await exists('game', b.game.id)).toBe(true)
  })
})

describe('routes d’administration', () => {
  const adminRoutes: Array<[string, string, unknown?]> = [
    ['GET', '/api/admin/users'],
    ['POST', '/api/admin/users', { email: 'nouveau@example.test', name: 'N', password: 'motdepasse123' }],
    ['PUT', `/api/admin/users/${alice.id}`, { role: 'admin' }],
    ['DELETE', `/api/admin/users/${carol.id}`],
    ['GET', '/api/admin/smtp'],
    ['PUT', '/api/admin/smtp', { enabled: false }],
    ['POST', '/api/admin/smtp/test', { to: 'x@example.test' }],
    ['POST', '/api/admin/mode', { enabled: true }]
  ]

  it.each(adminRoutes)('%s %s : refusé à une organisatrice', async (method, path, body) => {
    expect((await api(alice, method, path, body)).status).toBe(403)
  })

  it('accessible à un admin', async () => {
    expect((await api(admin, 'GET', '/api/admin/users')).status).toBe(200)
  })

  it('une organisatrice ne peut pas se promouvoir admin', async () => {
    const user = await prisma.user.findUnique({ where: { id: alice.id } })
    expect(user?.role).toBe('organizer')
  })
})

describe('sans authentification', () => {
  it.each(resources.map((resource) => resource.path))('GET /api/%s : 401', async (path) => {
    expect((await api(null, 'GET', `/api/${path}`)).status).toBe(401)
  })
})
