// US-010 : léguer une copie d'un jeu à une organisatrice qui a un compte (SPEC-002, ADR-0025)
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { DEFAULT_REGISTRATION_FORM_DEFINITION } from '~/utils/registrationForms'
import { api, DENIED } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp } from './smtp'

const world = inject('world')
const { alice, bob, carol, admin } = world.users
const prisma = createTestPrisma()
const PHOTOS = join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

// Jeu (d'Alice par défaut) avec tout son contenu d'écriture, ses liens, une photo téléversée et des données d'équipe.
// Les legs sont limités à 10 par heure et par compte : les tests d'US-011 lèguent depuis le compte de Bob.
async function sourceGame(owner: { id: string } = alice) {
  const key = `legs-${++counter}`
  const game = await prisma.game.create({
    data: { title: `Les Brumes ${key}`, slug: `les-brumes-${key}`, description: 'Un jeu', noteIntention: 'Intention', teaserUrl: 'https://example.test/teaser', ownerId: owner.id, publicPage: true }
  })
  const gameId = game.id

  const photoFile = `${key}.png`
  await mkdir(PHOTOS, { recursive: true })
  await writeFile(join(PHOTOS, photoFile), 'photo')
  const photoUrl = `/api/uploads/session-assignment-photos/${photoFile}`
  await prisma.uploadedFile.create({ data: { kind: 'session-assignment-photo', filename: photoFile, url: photoUrl, gameId } })

  // Deux personnages du même nom : leurs slugs dans la copie doivent rester distincts
  const hero = await prisma.character.create({
    data: { name: `Héros ${key}`, slug: `heros-${key}`, gameId, pitch: 'Pitch', trombinoscopePhotoUrl: photoUrl, trombinoscopeNote: 'Note' }
  })
  const twin = await prisma.character.create({
    data: { name: `Héros ${key}`, slug: `heros-${key}-2`, gameId, trombinoscopePhotoUrl: 'https://example.test/photo.png', published: false }
  })
  await prisma.characterTrombinoscopeEntry.create({
    data: { viewerCharacterId: hero.id, targetCharacterId: twin.id, faceKnown: false, displayName: 'Le jumeau' }
  })
  const intrigue = await prisma.intrigue.create({
    data: { name: `Complot ${key}`, slug: `complot-${key}`, gameId, level: 'major', characters: { connect: [{ id: hero.id }] } }
  })
  const faction = await prisma.faction.create({
    data: { name: `Guilde ${key}`, slug: `guilde-${key}`, gameId, characters: { connect: [{ id: twin.id }] }, intrigues: { connect: [{ id: intrigue.id }] } }
  })
  const item = await prisma.item.create({
    data: { name: `Dague ${key}`, slug: `dague-${key}`, gameId, quantity: 2, locationCharacterId: twin.id, characters: { connect: [{ id: hero.id }] }, intrigues: { connect: [{ id: intrigue.id }] } }
  })
  await prisma.timelineEvent.create({
    data: {
      name: `Bal ${key}`, slug: `bal-${key}`, gameId, day: 1, time: '20:00',
      characters: { connect: [{ id: hero.id }] }, factions: { connect: [{ id: faction.id }] },
      intrigues: { connect: [{ id: intrigue.id }] }, items: { connect: [{ id: item.id }] }
    }
  })
  await prisma.document.create({
    data: {
      title: `Lettre ${key}`, slug: `lettre-${key}`, gameId, content: 'Contenu', characterId: hero.id,
      characters: { connect: [{ id: twin.id }] }, factions: { connect: [{ id: faction.id }] }
    }
  })
  await prisma.location.create({ data: { name: `Château ${key}`, slug: `chateau-${key}`, gameId, address: 'Rue' } })

  // Formulaire en version 2 : seule celle-ci est copiée, et devient la version 1
  const current = { standardFields: { ...DEFAULT_REGISTRATION_FORM_DEFINITION.standardFields, facebookName: { asked: true, required: false } } }
  await prisma.registrationForm.create({
    data: { gameId, versions: { create: [{ number: 1, definition: DEFAULT_REGISTRATION_FORM_DEFINITION }, { number: 2, definition: current }] } }
  })

  // Données d'équipe, jamais copiées (R5)
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId } })
  const participant = await prisma.participant.create({ data: { name: `Joueuse ${key}`, slug: `joueuse-${key}`, gameLinks: { create: { gameId } } } })
  await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: hero.id, participantId: participant.id } })
  await prisma.registrationPeriod.create({ data: { name: `Période ${key}`, gameId, publicId: `pub-${key}` } })
  await prisma.gameShare.create({ data: { gameId, userId: carol.id } })

  return { game, hero, twin, photoUrl, current }
}

async function copiesOf(gameId: string) {
  return await prisma.game.findMany({
    where: { copiedFromGameId: gameId },
    include: {
      characters: { include: { trombinoscopeViewerEntries: true, factions: true, intrigues: true, items: true, documents: true, targetedDocuments: true, locatedItems: true } },
      factions: { include: { characters: true, intrigues: true } },
      intrigues: { include: { characters: true } },
      items: { include: { characters: true, intrigues: true } },
      timelineEvents: { include: { characters: true, factions: true, intrigues: true, items: true } },
      documents: { include: { characters: true, factions: true } },
      locations: true,
      uploadedFiles: true,
      registrationForm: { include: { versions: true } },
      sessions: true,
      participantLinks: true,
      shares: true,
      invitations: true,
      registrationPeriods: true
    }
  })
}

describe('legs d’un jeu à une organisatrice qui a un compte', () => {
  it('crée une copie complète et indépendante, attribuée à la destinataire', async () => {
    const { game, hero, twin, photoUrl, current } = await sourceGame()
    const sent = smtp.received.length

    const response = await api(alice, 'POST', `/api/games/${game.id}/bequests`, { email: 'BOB@example.test ' })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ recipient: { email: 'bob@example.test' }, emailDelivery: { sent: true } })

    const [copy] = await copiesOf(game.id)
    expect(copy).toMatchObject({
      title: game.title, description: 'Un jeu', noteIntention: 'Intention', teaserUrl: 'https://example.test/teaser',
      ownerId: bob.id, published: true, publicPage: false, bequestPending: false,
      creditSourceTitle: game.title, creditAuthorName: 'alice'
    })
    expect(copy!.slug).not.toBe(game.slug)

    // Personnages : nouveaux identifiants et slugs distincts, champs repris
    const sourceIds = new Set([hero.id, twin.id])
    expect(copy!.characters).toHaveLength(2)
    expect(copy!.characters.every((character) => !sourceIds.has(character.id))).toBe(true)
    expect(new Set(copy!.characters.map((character) => character.slug)).size).toBe(2)
    const copiedHero = copy!.characters.find((character) => character.pitch === 'Pitch')!
    const copiedTwin = copy!.characters.find((character) => character.id !== copiedHero.id)!
    expect(copiedTwin).toMatchObject({ published: false, trombinoscopePhotoUrl: 'https://example.test/photo.png' })

    // Trombinoscope et liens recréés entre éléments de la copie
    expect(copiedHero.trombinoscopeViewerEntries).toMatchObject([{ targetCharacterId: copiedTwin.id, faceKnown: false, displayName: 'Le jumeau' }])
    const [faction] = copy!.factions
    const [intrigue] = copy!.intrigues
    const [item] = copy!.items
    const [event] = copy!.timelineEvents
    const [document] = copy!.documents
    expect(intrigue).toMatchObject({ level: 'major', characters: [{ id: copiedHero.id }] })
    expect(faction).toMatchObject({ characters: [{ id: copiedTwin.id }], intrigues: [{ id: intrigue!.id }] })
    expect(item).toMatchObject({ quantity: 2, locationCharacterId: copiedTwin.id, characters: [{ id: copiedHero.id }], intrigues: [{ id: intrigue!.id }] })
    expect(event).toMatchObject({
      characters: [{ id: copiedHero.id }], factions: [{ id: faction!.id }], intrigues: [{ id: intrigue!.id }], items: [{ id: item!.id }]
    })
    expect(document).toMatchObject({ content: 'Contenu', characterId: copiedHero.id, characters: [{ id: copiedTwin.id }], factions: [{ id: faction!.id }] })
    expect(copy!.locations).toMatchObject([{ address: 'Rue' }])

    // Photo dupliquée sous un nouveau nom, rattachée à la copie (R6)
    expect(copiedHero.trombinoscopePhotoUrl).not.toBe(photoUrl)
    expect(copy!.uploadedFiles).toMatchObject([{ url: copiedHero.trombinoscopePhotoUrl, gameId: copy!.id, kind: 'session-assignment-photo' }])
    expect(existsSync(join(PHOTOS, basename(copiedHero.trombinoscopePhotoUrl!)))).toBe(true)

    // Formulaire : la version en vigueur devient la version 1 (R14)
    expect(copy!.registrationForm!.versions).toMatchObject([{ number: 1, definition: current }])

    // Rien des données d'équipe (R5)
    expect(copy).toMatchObject({ sessions: [], participantLinks: [], shares: [], invitations: [], registrationPeriods: [] })

    // La destinataire voit sa copie, son crédit et sa photo ; la propriétaire du jeu source n'y a pas accès
    const own = await api(bob, 'GET', `/api/games/slug/${copy!.slug}`)
    expect(own.body).toMatchObject({ creditSourceTitle: game.title, creditAuthorName: 'alice' })
    expect((await api(bob, 'GET', copiedHero.trombinoscopePhotoUrl!)).status).toBe(200)
    expect((await api(alice, 'GET', `/api/games/slug/${copy!.slug}`)).status).toBe(404)
    expect((await api(alice, 'GET', copiedHero.trombinoscopePhotoUrl!)).status).toBe(403)

    // Email à la destinataire, avec le lien vers la copie
    const email = smtp.received.slice(sent).find((message) => message.to.includes('bob@example.test'))
    expect(email?.text).toContain(`/games/${copy!.slug}`)
    expect(email?.text).toContain(game.title)
  })

  it('laisse la copie intacte quand le jeu source est modifié ou supprimé', async () => {
    const { game } = await sourceGame()
    expect((await api(alice, 'POST', `/api/games/${game.id}/bequests`, { email: 'bob@example.test' })).status).toBe(200)
    const [copy] = await copiesOf(game.id)
    const photo = copy!.characters.find((character) => character.trombinoscopePhotoUrl?.startsWith('/api/'))!.trombinoscopePhotoUrl!

    await prisma.character.updateMany({ where: { gameId: game.id }, data: { pitch: 'Modifié' } })
    expect((await api(alice, 'DELETE', `/api/games/${game.id}`)).status).toBe(200)

    const after = await prisma.game.findUnique({ where: { id: copy!.id }, include: { characters: true, uploadedFiles: true } })
    expect(after).toMatchObject({ copiedFromGameId: null, creditSourceTitle: game.title, creditAuthorName: 'alice' })
    expect(after!.characters.map((character) => character.pitch)).not.toContain('Modifié')
    expect(after!.uploadedFiles).toHaveLength(1)
    expect(existsSync(join(PHOTOS, basename(photo)))).toBe(true)
  })

  it('permet plusieurs legs du même jeu, chacun avec sa copie (R3)', async () => {
    const { game } = await sourceGame()
    expect((await api(alice, 'POST', `/api/games/${game.id}/bequests`, { email: 'bob@example.test' })).status).toBe(200)
    expect((await api(alice, 'POST', `/api/games/${game.id}/bequests`, { email: 'carol@example.test' })).status).toBe(200)
    const copies = await copiesOf(game.id)
    expect(copies.map((copy) => copy.ownerId).sort()).toEqual([bob.id, carol.id].sort())
    expect(new Set(copies.flatMap((copy) => copy.characters.map((character) => character.trombinoscopePhotoUrl))).size).toBe(3)
  })

  it('ne copie ni la photo d’un joueur ni le fichier d’un autre jeu, même référencés par un personnage', async () => {
    const { game } = await sourceGame()
    const session = await prisma.session.findFirstOrThrow({ where: { gameId: game.id } })
    const foreign = async (name: string, data: { gameId: string, sessionId?: string }) => {
      const filename = `${name}-${game.id}.png`
      await writeFile(join(PHOTOS, filename), 'photo')
      const url = `/api/uploads/session-assignment-photos/${filename}`
      await prisma.uploadedFile.create({ data: { kind: 'session-assignment-photo', filename, url, ...data } })
      await prisma.character.create({ data: { name, slug: `${name}-${game.id}`, gameId: game.id, trombinoscopePhotoUrl: url } })
    }
    await foreign('joueur', { gameId: game.id, sessionId: session.id })
    await foreign('etranger', { gameId: world.b.game.id })

    expect((await api(alice, 'POST', `/api/games/${game.id}/bequests`, { email: 'bob@example.test' })).status).toBe(200)
    const [copy] = await copiesOf(game.id)
    expect(copy!.characters.filter((character) => ['joueur', 'etranger'].includes(character.name)).map((character) => character.trombinoscopePhotoUrl)).toEqual([null, null])
    expect(copy!.uploadedFiles).toHaveLength(1)
  })

  it('refuse de léguer à soi-même ou à une adresse invalide, sans rien créer', async () => {
    const { game } = await sourceGame()
    const self = await api(alice, 'POST', `/api/games/${game.id}/bequests`, { email: 'alice@example.test' })
    expect(self.status).toBe(400)
    expect((self.body as any).message).toContain('propre jeu')
    expect((await api(alice, 'POST', `/api/games/${game.id}/bequests`, { email: 'pas-un-email' })).status).toBe(400)
    expect(await copiesOf(game.id)).toHaveLength(0)
  })

  it('refuse le legs à une co-organisatrice du jeu (R1)', async () => {
    const { game } = await sourceGame()
    expect((await api(carol, 'POST', `/api/games/${game.id}/bequests`, { email: 'bob@example.test' })).status).toBe(403)
    expect(await copiesOf(game.id)).toHaveLength(0)
  })
})

describe('legs à une personne sans compte (US-011)', () => {
  const tokenIn = (text: string) => text.match(/\/invitations\/([\w-]+)/)?.[1]
  let counter = 0

  // Legs à une adresse sans compte : copie en attente et email d'invitation
  async function pendingBequest() {
    const { game } = await sourceGame(bob)
    const email = `nouvelle-${++counter}@example.test`
    const sent = smtp.received.length
    const response = await api(bob, 'POST', `/api/games/${game.id}/bequests`, { email })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ pending: true, recipient: { email } })
    const message = smtp.received.slice(sent).find((received) => received.to.includes(email))!
    const [copy] = await copiesOf(game.id)
    return { game, email, copy: copy!, message, token: tokenIn(message.text)! }
  }

  it('crée une copie en attente, invisible pour tous, et envoie une invitation', async () => {
    const { game, copy, message, token } = await pendingBequest()
    expect(copy).toMatchObject({ ownerId: null, bequestPending: true, creditSourceTitle: game.title })
    expect(copy.characters).toHaveLength(2)
    expect(message.text).toContain('vous lègue une copie')
    expect(token).toBeTruthy()

    // Ni la propriétaire du jeu source (Bob ici), ni une autre organisatrice, ni le mode administrateur
    for (const [user, options] of [[bob, {}], [alice, {}], [admin, { adminMode: true }]] as const) {
      const games = await api(user, 'GET', '/api/games', undefined, options)
      expect(JSON.stringify(games.body)).not.toContain(copy.id)
      expect(DENIED).toContain((await api(user, 'GET', `/api/games/${copy.id}`, undefined, options)).status)
      expect((await api(user, 'GET', `/api/games/slug/${copy.slug}`, undefined, options)).status).toBe(404)
      expect((await api(user, 'GET', `/api/characters/${copy.characters[0]!.id}`, undefined, options)).status).toBe(404)
      const characters = await api(user, 'GET', '/api/characters', undefined, options)
      expect(JSON.stringify(characters.body)).not.toContain(copy.characters[0]!.id)
    }
    // Témoin : le mode administrateur voit bien le jeu source
    expect((await api(admin, 'GET', `/api/games/${game.id}`, undefined, { adminMode: true })).status).toBe(200)
  })

  it('attribue la copie à la création du compte par le lien, sans co-organisation', async () => {
    const { email, copy, token } = await pendingBequest()
    expect((await api(null, 'GET', `/api/invitations/${token}`)).body).toMatchObject({ kind: 'bequest', inviterName: 'bob', email })

    const response = await api(null, 'POST', '/api/auth/register', { token, email, name: 'Nouvelle', password: 'mot-de-passe-solide' })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(await prisma.game.findUnique({ where: { id: copy.id } })).toMatchObject({ ownerId: user.id, bequestPending: false })
    expect(await prisma.gameShare.count({ where: { userId: user.id } })).toBe(0)
    expect((await api(user, 'GET', `/api/games/slug/${copy.slug}`)).status).toBe(200)
    // Le lien ne sert qu'une fois
    expect((await api(null, 'GET', `/api/invitations/${token}`)).status).toBe(400)
  })

  it('attribue la copie à un compte créé entre-temps, après connexion', async () => {
    const { email, copy, token } = await pendingBequest()
    const user = await prisma.user.create({ data: { email, name: 'Arrivée entre-temps', password: 'non-utilise' } })
    expect((await api(user, 'POST', '/api/invitations/accept', { token })).status).toBe(200)
    expect(await prisma.game.findUnique({ where: { id: copy.id } })).toMatchObject({ ownerId: user.id, bequestPending: false })
  })

  it('refuse que la propriétaire du jeu source reçoive son propre legs', async () => {
    const { copy, token } = await pendingBequest()
    expect((await api(bob, 'POST', '/api/invitations/accept', { token })).status).toBe(400)
    expect(await prisma.game.findUnique({ where: { id: copy.id } })).toMatchObject({ ownerId: null, bequestPending: true })
  })

  it('supprime la copie et ses fichiers quand l’invitation a expiré', async () => {
    const { copy, token } = await pendingBequest()
    const photo = copy.uploadedFiles[0]!.url
    await prisma.gameInvitation.updateMany({ where: { token }, data: { expiresAt: new Date(Date.now() - 1000) } })

    const response = await api(null, 'GET', `/api/invitations/${token}`)
    expect(response.status).toBe(400)
    expect(JSON.stringify(response.body)).toContain('supprimée')
    expect(await prisma.game.findUnique({ where: { id: copy.id } })).toBeNull()
    expect(existsSync(join(PHOTOS, basename(photo)))).toBe(false)
  })

  it('supprime les legs en attente avec le jeu source', async () => {
    const { game, copy, token } = await pendingBequest()
    expect((await api(bob, 'DELETE', `/api/games/${game.id}`)).status).toBe(200)
    expect(await prisma.game.findUnique({ where: { id: copy.id } })).toBeNull()
    expect(existsSync(join(PHOTOS, basename(copy.uploadedFiles[0]!.url)))).toBe(false)
    expect((await api(null, 'GET', `/api/invitations/${token}`)).status).toBe(404)
  })

  it('ne lègue rien quand l’invitation ne peut pas partir', async () => {
    const { game } = await sourceGame(bob)
    await smtp.disable()
    try {
      const response = await api(bob, 'POST', `/api/games/${game.id}/bequests`, { email: 'injoignable@example.test' })
      expect(response.status).toBe(502)
    } finally {
      await smtp.enable()
    }
    expect(await copiesOf(game.id)).toHaveLength(0)
  })

  it('une invitation de co-organisation donne toujours un accès partagé', async () => {
    const { game } = await sourceGame()
    const sent = smtp.received.length
    expect((await api(alice, 'POST', `/api/games/${game.id}/invitations`, { email: 'bob@example.test' })).status).toBe(200)
    const token = tokenIn(smtp.received.slice(sent).find((received) => received.to.includes('bob@example.test'))!.text)!
    expect((await api(bob, 'POST', '/api/invitations/accept', { token })).status).toBe(200)
    expect(await prisma.gameShare.count({ where: { gameId: game.id, userId: bob.id } })).toBe(1)
    expect(await prisma.game.findUnique({ where: { id: game.id } })).toMatchObject({ ownerId: alice.id })
  })
})
