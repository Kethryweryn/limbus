// EPIC-007 : retrait d'un jeu et fiches toujours liées à un jeu
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { isParticipantSlug } from '~/utils/participantSlug'
import { withFicheValues } from '../fiche'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

// Une personne liée à deux jeux d'Alice, avec une session dans chacun
async function personInTwoGames() {
  const key = `retrait-${++counter}`
  const games = await Promise.all(['Un', 'Deux'].map((name) =>
    prisma.game.create({ data: { title: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, description: '', ownerId: alice.id } })
  ))
  const participant = await withFicheValues(prisma.participant.create({
    data: { slug: `lea-${key}`, email: `lea-${key}@example.test`, gameLinks: { create: games.map((game) => ({ gameId: game.id , name: `Léa ${key}` })) } }
  }), { name: `Léa ${key}` })
  const sessions = []
  for (const game of games) {
    const character = await prisma.character.create({ data: { name: `Rôle ${game.slug}`, slug: `role-${game.slug}`, gameId: game.id } })
    const session = await prisma.session.create({ data: { slug: `session-${game.slug}`, gameId: game.id } })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'participant' } })
    await prisma.sessionAssignment.create({ data: { gameId: session.gameId, sessionId: session.id, characterId: character.id, participantId: participant.id } })
    await prisma.sessionAttendance.create({ data: { sessionId: session.id, participantId: participant.id, responseDueAt: new Date(Date.now() + 86_400_000) } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `periode-${game.slug}` } })
    await prisma.registration.create({
      data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'invitation', email: participant.email!, sessionLines: { create: { sessionId: session.id, status: 'confirmed' } } }
    })
    sessions.push(session)
  }
  const update = (gameIds: string[]) => api(alice, 'PUT', `/api/participants/${participant.id}`, { name: participant.name, email: participant.email, gameIds })
  return { games, participant, sessions, update }
}

describe('retrait d’un jeu (US-035)', () => {
  it('retire la personne des sessions du jeu et marque ses inscriptions « retirée », sans toucher l’autre jeu', async () => {
    const p = await personInTwoGames()
    await prisma.sessionPayment.create({ data: { gameId: p.sessions[0]!.gameId, sessionId: p.sessions[0]!.id, participantId: p.participant.id, paidAt: new Date() } })

    const response = await p.update([p.games[1]!.id])
    expect(response.status, JSON.stringify(response.body)).toBe(200)

    const removed = { sessionId: p.sessions[0]!.id, participantId: p.participant.id }
    expect(await prisma.sessionParticipant.count({ where: removed })).toBe(0)
    expect(await prisma.sessionAssignment.count({ where: removed })).toBe(0)
    expect(await prisma.sessionAssignment.count({ where: { sessionId: p.sessions[0]!.id } })).toBe(1)
    expect(await prisma.sessionAttendance.count({ where: removed })).toBe(0)
    const line = await prisma.registrationSession.findFirstOrThrow({ where: { sessionId: removed.sessionId, registration: { participantId: removed.participantId } }, include: { registration: true } })
    expect(line).toMatchObject({ status: 'cancelled', cancelledById: alice.id, registration: { status: 'withdrawn', withdrawnById: alice.id } })
    expect(await prisma.registrationLink.count({ where: { registrationId: line.registrationId } })).toBe(0)
    // Le paiement reste, à traiter à part
    expect(await prisma.sessionPayment.count({ where: removed })).toBe(1)

    const kept = { sessionId: p.sessions[1]!.id, participantId: p.participant.id }
    expect(await prisma.sessionParticipant.count({ where: kept })).toBe(1)
    expect(await prisma.sessionAssignment.count({ where: kept })).toBe(1)
    expect(await prisma.registrationSession.findFirstOrThrow({ where: { sessionId: kept.sessionId, registration: { participantId: kept.participantId } }, include: { registration: true } }))
      .toMatchObject({ status: 'confirmed', registration: { status: 'received' } })
  })
})

describe('une fiche a toujours un jeu (US-036)', () => {
  it('refuse une création sans jeu', async () => {
    expect((await api(alice, 'POST', '/api/participants', { name: 'Sans jeu' })).status).toBe(400)
  })

  it('retirer le dernier jeu supprime la fiche, mais pas si un jeu d’une autre équipe la garde', async () => {
    const p = await personInTwoGames()
    expect((await p.update([p.games[0]!.id])).status).toBe(200)
    const last = await p.update([])
    expect(last.status, JSON.stringify(last.body)).toBe(200)
    expect(last.body).toEqual({ deleted: true })
    expect(await prisma.participant.count({ where: { id: p.participant.id } })).toBe(0)

    // Une fiche liée aussi au jeu de Bob : Alice retire son dernier jeu, la fiche reste
    const shared = await personInTwoGames()
    await prisma.participantGame.create({ data: { participantId: shared.participant.id, gameId: world.b.game.id, name: shared.participant.name } })
    const response = await shared.update([])
    expect(response.status).toBe(200)
    expect(response.body).not.toEqual({ deleted: true })
    expect(await prisma.participant.count({ where: { id: shared.participant.id } })).toBe(1)
  })
})

describe('`published` retiré des fiches (US-038)', () => {
  it('n’est ni accepté ni renvoyé', async () => {
    const created = await api(alice, 'POST', '/api/participants', { name: 'Sans published', email: `sans-published-${++counter}@example.test`, gameIds: [world.a.game.id], published: false })
    expect(created.status, JSON.stringify(created.body)).toBe(200)
    expect(created.body).not.toHaveProperty('published')
    const id = (created.body as { id: string }).id
    expect((await prisma.participant.findUniqueOrThrow({ where: { id } })).published).toBe(true)
    expect((await api(alice, 'GET', `/api/participants/${id}`)).body).not.toHaveProperty('published')
  })
})


// EPIC-014 : une note par jeu (US-069, ADR-0040)
describe('notes propres à chaque jeu (US-069)', () => {
  const { bob } = world.users

  async function sharedPerson() {
    const key = `notes-${++counter}`
    const [aliceGame, bobGame] = await Promise.all([alice, bob].map((owner) =>
      prisma.game.create({ data: { title: `Jeu ${owner.id} ${key}`, slug: `jeu-${owner.id}-${key}`.toLowerCase(), description: '', ownerId: owner.id } })
    ))
    const participant = await withFicheValues(prisma.participant.create({
      data: {
        slug: `noe-${key}`,
        email: `noe-${key}@example.test`,
        gameLinks: { create: [{ gameId: aliceGame!.id, notes: 'Note d’Alice' , name: `Noé ${key}` }, { gameId: bobGame!.id, notes: 'Note de Bob' , name: `Noé ${key}` }] }
      }
    }), { name: `Noé ${key}` })
    return { aliceGame: aliceGame!, bobGame: bobGame!, participant }
  }

  it('chaque équipe ne lit que la note de son jeu', async () => {
    const { aliceGame, bobGame, participant } = await sharedPerson()
    const forAlice = await api(alice, 'GET', `/api/participants/${participant.id}`)
    expect(forAlice.body).toMatchObject({ gameNotes: { [aliceGame.id]: 'Note d’Alice' } })
    expect(JSON.stringify(forAlice.body)).not.toContain('Note de Bob')
    // Témoin : Bob lit la sienne
    expect((await api(bob, 'GET', `/api/participants/${participant.id}`)).body).toMatchObject({ gameNotes: { [bobGame.id]: 'Note de Bob' } })
    const list = await api(alice, 'GET', '/api/participants')
    expect(JSON.stringify(list.body)).not.toContain('Note de Bob')
    const exported = await api(alice, 'GET', `/api/participants/${participant.id}/export`)
    expect(JSON.stringify(exported.body)).toContain('Note d’Alice')
    expect(JSON.stringify(exported.body)).not.toContain('Note de Bob')
  })

  it('modifier sa note ne touche pas celle de l’autre équipe ; écrire la sienne est refusé', async () => {
    const { aliceGame, bobGame, participant } = await sharedPerson()
    const updated = await api(alice, 'PUT', `/api/participants/${participant.id}`, { name: participant.name, email: participant.email, gameIds: [aliceGame.id], gameNotes: { [aliceGame.id]: 'Nouvelle note' } })
    expect(updated.status).toBe(200)
    const links = await prisma.participantGame.findMany({ where: { participantId: participant.id }, select: { gameId: true, notes: true } })
    expect(Object.fromEntries(links.map((link) => [link.gameId, link.notes]))).toEqual({ [aliceGame.id]: 'Nouvelle note', [bobGame.id]: 'Note de Bob' })

    const refused = await api(alice, 'PUT', `/api/participants/${participant.id}`, { name: participant.name, email: participant.email, gameIds: [aliceGame.id], gameNotes: { [bobGame.id]: 'Intrusion' } })
    expect(refused.status).toBe(403)
    expect((await prisma.participantGame.findFirstOrThrow({ where: { participantId: participant.id, gameId: bobGame.id } })).notes).toBe('Note de Bob')
  })

  it('une fiche créée reçoit la note de chacun de ses jeux', async () => {
    const game = await prisma.game.create({ data: { title: 'Jeu créé', slug: `jeu-cree-${++counter}`, description: '', ownerId: alice.id } })
    const created = await api(alice, 'POST', '/api/participants', { name: `Créée ${counter}`, email: `creee-${counter}@example.test`, gameIds: [game.id], gameNotes: { [game.id]: 'Première note' } })
    expect(created.status).toBe(200)
    expect(created.body).toMatchObject({ gameNotes: { [game.id]: 'Première note' } })
    expect(created.body).not.toHaveProperty('notes')
  })
})

describe('une seule fiche par adresse (US-185, US-239)', () => {
  type Created = { id: string, joinedExisting: boolean, name: string, games: Array<{ id: string }>, gameNotes: Record<string, string | null> }
  const { bob, carol } = world.users

  async function aliceFiche() {
    const key = `adresse-${++counter}`
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const other = await prisma.game.create({ data: { title: `Autre ${key}`, slug: `autre-${key}`, description: '', ownerId: alice.id } })
    const existing = await withFicheValues(prisma.participant.create({
      data: { slug: `camille-${key}`, email: `camille-${key}@example.test`, gameLinks: { create: { gameId: game.id, notes: 'Note du premier jeu', name: `Camille ${key}`, phone: '0601010101' } } }
    }), { name: `Camille ${key}`, phone: '0601010101' })
    return { key, game, other, existing }
  }

  it('créer avec une adresse déjà connue ajoute le jeu à la fiche existante, sans toucher à son nom ni à son téléphone', async () => {
    const { key, game, other, existing } = await aliceFiche()
    const response = await api(alice, 'POST', '/api/participants', { name: 'Autre nom', email: ` Camille-${key}@EXAMPLE.test `, phone: '0700000000', gameIds: [other.id], gameNotes: { [other.id]: 'Note du second jeu' } })
    expect(response.status).toBe(200)
    const created = response.body as Created
    expect(created).toMatchObject({ id: existing.id, joinedExisting: true, name: existing.name })
    expect(created.games.map((row) => row.id).sort()).toEqual([game.id, other.id].sort())
    expect(created.gameNotes).toEqual({ [game.id]: 'Note du premier jeu', [other.id]: 'Note du second jeu' })
    expect(await prisma.participant.count({ where: { email: existing.email! } })).toBe(1)
    expect(await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: existing.id, gameId: game.id } }, select: { phone: true } })).toEqual({ phone: '0601010101' })

    // Jeu déjà lié : la note donnée s'ajoute à la sienne, sans l'effacer
    await api(alice, 'POST', '/api/participants', { name: 'Encore', email: existing.email, gameIds: [game.id], gameNotes: { [game.id]: 'Ajout' } })
    expect((await prisma.participantGame.findFirstOrThrow({ where: { participantId: existing.id, gameId: game.id } })).notes).toBe('Note du premier jeu\n\nAjout')

    // Témoin : une autre adresse crée une fiche
    const fresh = await api(alice, 'POST', '/api/participants', { name: 'Autre', email: `autre-${key}@example.test`, gameIds: [other.id] })
    expect((fresh.body as Created).joinedExisting).toBe(false)
  })

  it('une co-organisatrice qui ne voit pas le jeu de la fiche y ajoute le sien, avec son nom, et n’en voit que son jeu', async () => {
    const { key, game, other, existing } = await aliceFiche()
    await prisma.gameShare.create({ data: { gameId: other.id, userId: carol.id } })
    const response = await api(carol, 'POST', '/api/participants', { name: 'Saisie par Carol', email: existing.email, gameIds: [other.id] })
    expect(response.status).toBe(200)
    const created = response.body as Created
    // La fiche n'était pas dans ses jeux : la réponse est celle d'une création (SPEC-022 R4)
    expect(created).toMatchObject({ id: existing.id, joinedExisting: false, name: 'Saisie par Carol' })
    expect(JSON.stringify(created)).not.toContain(`Camille ${key}`)
    expect(created.games.map((row) => row.id)).toEqual([other.id])
    expect(Object.keys(created.gameNotes)).toEqual([other.id])
    expect(JSON.stringify(created)).not.toContain(game.id)
  })

  // SPEC-022 R4 : une fiche par adresse dans tout Limbus, même suivie par une autre équipe, sans rien en montrer
  it('une fiche d’une autre propriétaire est rejointe, sans que rien ne le dise ni ne montre de l’autre équipe', async () => {
    const key = `adresse-bob-${++counter}`
    const bobGame = await prisma.game.create({ data: { title: `Bob ${key}`, slug: `bob-${key}`, description: '', ownerId: bob.id } })
    const bobs = await withFicheValues(prisma.participant.create({ data: { slug: `chez-bob-${key}`, email: `partage-${key}@example.test`, gameLinks: { create: { gameId: bobGame.id, name: `Chez Bob ${key}`, phone: '0699999999', notes: 'Note de Bob' } } } }), { name: `Chez Bob ${key}` })
    const game = await prisma.game.create({ data: { title: `Alice ${key}`, slug: `alice-${key}`, description: '', ownerId: alice.id } })
    const response = await api(alice, 'POST', '/api/participants', { name: 'Chez Alice', email: ` ${bobs.email!.toUpperCase()} `, phone: '0611111111', gameIds: [game.id] })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const created = response.body as Created
    expect(created).toMatchObject({ id: bobs.id, joinedExisting: false, name: 'Chez Alice' })
    expect(created.games.map((row) => row.id)).toEqual([game.id])
    expect(JSON.stringify(created)).not.toMatch(/Chez Bob|Note de Bob|0699999999/)
    expect(await prisma.participant.count({ where: { email: bobs.email! } })).toBe(1)
    // Bob ne voit rien d'Alice, et garde son nom
    const bobRead = (await api(bob, 'GET', `/api/participants/${bobs.id}`)).body as { name: string, games: Array<{ id: string }> }
    expect(bobRead).toMatchObject({ name: `Chez Bob ${key}` })
    expect(bobRead.games.map((row) => row.id)).toEqual([bobGame.id])
    // L'adresse de page ne suit pas le nom (US-239)
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: bobs.id } })).slug).toBe(bobs.slug)
    // Alice ne lit pas la date de création de Bob, ni son nom dans l'export (revue de la PR #232)
    const aliceRead = (await api(alice, 'GET', `/api/participants/${bobs.id}`)).body as { createdAt: string }
    expect(new Date(aliceRead.createdAt).getTime()).toBeGreaterThan(bobs.createdAt.getTime())
    const exported = (await api(alice, 'GET', `/api/participants/${bobs.id}/export`)).body as { name: string, createdAt: string }
    expect(exported).toMatchObject({ name: 'Chez Alice', createdAt: aliceRead.createdAt })
    expect(JSON.stringify(exported)).not.toMatch(/Chez Bob|Note de Bob|0699999999/)
  })

  it('une fiche créée a une adresse de page neutre, sans son nom (US-239)', async () => {
    const created = (await api(alice, 'POST', '/api/participants', { name: 'Nom secret', email: `neutre-${++counter}@example.test`, gameIds: [world.a.game.id] })).body as { slug: string }
    expect(isParticipantSlug(created.slug)).toBe(true)
  })

  // Donner à une fiche l'adresse d'une autre la rejoint (SPEC-022 R7) : tests/integration/participantMove.test.ts
})

// Nom et téléphone tenus par jeu (SPEC-022 R6, ADR-0086, US-237) : écrits sur chaque lien, en plus de la fiche
describe('nom et téléphone par jeu (US-237)', () => {
  const { bob, carol } = world.users
  const links = (participantId: string) => prisma.participantGame.findMany({ where: { participantId }, select: { gameId: true, name: true, phone: true }, orderBy: { createdAt: 'asc' } })

  it('une création écrit le nom et le téléphone sur chacun de ses jeux', async () => {
    const key = `par-jeu-${++counter}`
    const games = await Promise.all(['Un', 'Deux'].map((name) => prisma.game.create({ data: { title: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, description: '', ownerId: alice.id } })))
    const response = await api(alice, 'POST', '/api/participants', { name: `Zoé ${key}`, email: `zoe-${key}@example.test`, phone: '0611111111', gameIds: games.map((game) => game.id) })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const { id } = response.body as { id: string }
    expect((await links(id)).map(({ name, phone }) => ({ name, phone }))).toEqual([{ name: `Zoé ${key}`, phone: '0611111111' }, { name: `Zoé ${key}`, phone: '0611111111' }])
  })

  it('une modification change les seuls jeux que voit la personne qui modifie', async () => {
    const key = `par-jeu-${++counter}`
    const [mine, shared] = await Promise.all(['Mien', 'Partagé'].map((name) => prisma.game.create({ data: { title: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), description: '', ownerId: alice.id } })))
    const bobGame = await prisma.game.create({ data: { title: `Bob ${key}`, slug: `bob-${key}`, description: '', ownerId: bob.id } })
    await prisma.gameShare.create({ data: { gameId: shared!.id, userId: carol.id } })
    const participant = await withFicheValues(prisma.participant.create({
      data: {
        slug: `ilan-${key}`,
        email: `ilan-${key}@example.test`,
        gameLinks: { create: [mine!, shared!, bobGame].map((game) => ({ gameId: game.id, name: `Ilan ${key}`, phone: '0600000000' })) }
      }
    }), { name: `Ilan ${key}` })
    const response = await api(carol, 'PUT', `/api/participants/${participant.id}`, { name: `Ilan par Carol ${key}`, email: participant.email, phone: '0699999999', gameIds: [shared!.id] })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const byGame = new Map((await links(participant.id)).map((link) => [link.gameId, link]))
    expect(byGame.get(shared!.id)).toMatchObject({ name: `Ilan par Carol ${key}`, phone: '0699999999' })
    // Témoins : le jeu d'Alice que Carol ne voit pas et celui de Bob ne changent pas
    expect(byGame.get(mine!.id)).toMatchObject({ name: `Ilan ${key}`, phone: '0600000000' })
    expect(byGame.get(bobGame.id)).toMatchObject({ name: `Ilan ${key}`, phone: '0600000000' })
  })

  it('les coordonnées enregistrées dans le compte sont recopiées sur chaque jeu de ses fiches', async () => {
    const key = `par-jeu-${++counter}`
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const user = await prisma.user.create({ data: { email: `compte-${key}@example.test`, name: `Compte ${key}`, password: 'x', phone: '0688888888', profileUpdatedAt: new Date() } })
    const response = await api(alice, 'POST', '/api/participants', { name: `Saisi ${key}`, email: user.email, phone: '0611111111', gameIds: [game.id] })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(await links((response.body as { id: string }).id)).toEqual([{ gameId: game.id, name: `Compte ${key}`, phone: '0688888888' }])
  })
})

// Lectures par jeu (US-237, étape 2) : une même fiche suivie par Alice et Bob, nommée différemment dans chaque jeu
describe('chaque équipe lit le nom et le téléphone de son jeu (US-237)', () => {
  const { bob } = world.users

  async function sharedFiche() {
    const key = `lecture-${++counter}`
    const [aliceGame, bobGame] = await Promise.all([alice, bob].map((owner, index) =>
      prisma.game.create({ data: { title: `Jeu ${index} ${key}`, slug: `jeu-${index}-${key}`, description: '', ownerId: owner.id } })
    ))
    const participant = await withFicheValues(prisma.participant.create({
      data: {
        slug: `fiche-${key}`,
        email: `fiche-${key}@example.test`,
        gameLinks: { create: [{ gameId: aliceGame!.id, name: `Nom d’Alice ${key}`, phone: '0611111111' }, { gameId: bobGame!.id, name: `Nom de Bob ${key}`, phone: '0622222222' }] }
      }
    }), { name: `Fiche ${key}` })
    const sessions = await Promise.all([aliceGame!, bobGame!].map(async (game) => {
      const session = await prisma.session.create({ data: { slug: `session-${game.slug}`, gameId: game.id } })
      await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'participant' } })
      return session
    }))
    return { key, aliceGame: aliceGame!, bobGame: bobGame!, participant, sessions }
  }

  it('dans la liste, la fiche, les sessions et les paiements', async () => {
    const { key, participant, sessions } = await sharedFiche()
    for (const [user, name, phone, session] of [[alice, `Nom d’Alice ${key}`, '0611111111', sessions[0]!], [bob, `Nom de Bob ${key}`, '0622222222', sessions[1]!]] as const) {
      const list = (await api(user, 'GET', '/api/participants')).body as Array<{ id: string, name: string, phone: string | null }>
      expect(list.find((row) => row.id === participant.id)).toMatchObject({ name, phone })
      const fiche = (await api(user, 'GET', `/api/participants/${participant.id}`)).body as { name: string, phone: string | null }
      expect(fiche).toMatchObject({ name, phone })
      const read = (await api(user, 'GET', `/api/sessions/${session.id}`)).body as { participants: Array<{ participant: { name: string } }> }
      expect(read.participants.map((row) => row.participant.name)).toEqual([name])
      const sessionsList = (await api(user, 'GET', '/api/sessions')).body as Array<{ id: string, participants: Array<{ participant: { name: string } }> }>
      expect(sessionsList.find((row) => row.id === session.id)!.participants[0]!.participant.name).toBe(name)
      const payments = await api(user, 'GET', `/api/sessions/${session.id}/payments`)
      expect(JSON.stringify(payments.body)).toContain(name)
      // Rien de l'autre équipe
      expect(JSON.stringify([list, fiche, read, payments.body])).not.toContain(user === alice ? 'Nom de Bob' : 'Nom d’Alice')
    }
  })
})

// Version d'une fiche par équipe (US-237, étape 3, ADR-0086) : le plus récent des liens qu'elle voit
describe('version de la fiche par équipe (US-237)', () => {
  const { bob, carol } = world.users
  const since = (version: string) => ({ headers: { 'if-unmodified-since': version } })

  async function fiche() {
    const key = `version-${++counter}`
    const [aliceGame, sharedGame, bobGame] = await Promise.all([[alice, 'a'], [alice, 'p'], [bob, 'b']].map(([owner, tag]) =>
      prisma.game.create({ data: { title: `Jeu ${tag} ${key}`, slug: `jeu-${tag}-${key}`, description: '', ownerId: (owner as typeof alice).id } })
    ))
    await prisma.gameShare.create({ data: { gameId: sharedGame!.id, userId: carol.id } })
    const participant = await withFicheValues(prisma.participant.create({
      data: {
        slug: `lou-${key}`,
        email: `lou-${key}@example.test`,
        gameLinks: { create: [aliceGame!, sharedGame!, bobGame!].map((game) => ({ gameId: game.id, name: `Lou ${key}` })) }
      }
    }), { name: `Lou ${key}` })
    return { key, aliceGame: aliceGame!, sharedGame: sharedGame!, bobGame: bobGame!, participant }
  }
  const read = async (user: typeof alice, id: string) => (await api(user, 'GET', `/api/participants/${id}`)).body as { updatedAt: string }

  it('une modification d’une autre équipe ne refuse rien et ne change pas la version lue', async () => {
    const { key, aliceGame, sharedGame, bobGame, participant } = await fiche()
    const aliceVersion = (await read(alice, participant.id)).updatedAt
    const bobVersion = (await read(bob, participant.id)).updatedAt
    expect((await api(bob, 'PUT', `/api/participants/${participant.id}`, { name: `Lou par Bob ${key}`, email: participant.email, gameIds: [bobGame.id] }, since(bobVersion))).status).toBe(200)
    expect((await read(alice, participant.id)).updatedAt).toBe(aliceVersion)
    const response = await api(alice, 'PUT', `/api/participants/${participant.id}`, { name: `Lou par Alice ${key}`, email: participant.email, gameIds: [aliceGame.id, sharedGame.id] }, since(aliceVersion))
    expect(response.status, JSON.stringify(response.body)).toBe(200)
  })

  it('une modification d’un jeu que je vois refuse la mienne, faite sur une version plus ancienne', async () => {
    const { key, aliceGame, sharedGame, participant } = await fiche()
    const aliceVersion = (await read(alice, participant.id)).updatedAt
    const carolVersion = (await read(carol, participant.id)).updatedAt
    expect((await api(carol, 'PUT', `/api/participants/${participant.id}`, { name: `Lou par Carol ${key}`, email: participant.email, gameIds: [sharedGame.id] }, since(carolVersion))).status).toBe(200)
    const refused = await api(alice, 'PUT', `/api/participants/${participant.id}`, { name: `Lou par Alice ${key}`, email: participant.email, gameIds: [aliceGame.id, sharedGame.id] }, since(aliceVersion))
    expect(refused.status).toBe(409)
    // Rien d'enregistré : le jeu partagé garde le nom donné par Carol
    expect((await prisma.participantGame.findFirstOrThrow({ where: { participantId: participant.id, gameId: sharedGame.id } })).name).toBe(`Lou par Carol ${key}`)
  })
})
