// US-150, US-151 : rechargement des jeux de test (ADR-0066). Le script tourne sur la base de test,
// avec un compte propriétaire propre à ce fichier ; le reste de la base sert de témoin.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import bcrypt from 'bcrypt'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api } from './api'
import { createTestPrisma, testDatabaseUrl } from './db'

const prisma = createTestPrisma()
const OWNER = 'seed-proprietaire@example.test'
const PASSWORD = 'mot-de-passe-des-essais'
const GAME_IDS = ['jeu-test-valombre', 'jeu-test-meridian', 'jeu-test-bal']

function runSeed(env: Record<string, string> = { SEED_ALLOW_ERASE: '1', SEED_EMAIL: OWNER, SEED_PASSWORD: PASSWORD }) {
  const run = spawnSync('npx', ['tsx', 'prisma/seed.ts'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl(), ...env },
    encoding: 'utf8',
    shell: process.platform === 'win32'
  })
  return { status: run.status, output: `${run.stdout}${run.stderr}` }
}

function expectSuccess(run: ReturnType<typeof runSeed>) {
  expect(run.status, run.output).toBe(0)
}

function plusAddress(localPart: string) {
  return `seed-proprietaire+${localPart}@example.test`
}

describe('rechargement des jeux de test', () => {
  let ownerId: string

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { email: OWNER, name: 'Propriétaire des essais', password: await bcrypt.hash(PASSWORD, 4) }
    })
    ownerId = owner.id
  })

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { gameLinks: { some: { gameId: { in: GAME_IDS } } } } })
    await prisma.game.deleteMany({ where: { id: { in: GAME_IDS } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: 'seed-proprietaire' } } })
    await prisma.user.deleteMany({ where: { email: { in: ['ines.lefevre@example.test', 'camille.bernard@example.test', 'lucie.moreau@example.test'] } } })
    await prisma.$disconnect()
  })

  it('refuse sans confirmation, sans rien écrire', async () => {
    const run = runSeed({ SEED_EMAIL: OWNER })
    expect(run.status).not.toBe(0)
    expect(run.output).toContain('SEED_ALLOW_ERASE=1')
    expect(await prisma.game.count({ where: { id: { in: GAME_IDS } } })).toBe(0)
  })

  it('refuse un SEED_EMAIL sans compte, sans rien écrire', async () => {
    const run = runSeed({ SEED_ALLOW_ERASE: '1', SEED_EMAIL: 'personne@example.test' })
    expect(run.status).not.toBe(0)
    expect(run.output).toContain('SEED_EMAIL')
    expect(await prisma.game.count({ where: { id: { in: GAME_IDS } } })).toBe(0)
  })

  it('refuse quand l\'adresse d\'un jeu de test est prise par un autre jeu, sans le toucher', async () => {
    const other = await prisma.game.create({ data: { title: 'Station Meridian', slug: 'station-meridian', description: '', ownerId } })
    const run = runSeed()
    expect(run.status).not.toBe(0)
    expect(run.output).toContain('station-meridian')
    expect(await prisma.game.findUnique({ where: { id: other.id } })).not.toBeNull()
    expect(await prisma.game.count({ where: { id: { in: GAME_IDS } } })).toBe(0)
    await prisma.game.delete({ where: { id: other.id } })
  })

  it('remplace sur demande un jeu reconnu à son adresse', async () => {
    const legacy = await prisma.game.create({ data: { title: 'Station Meridian', slug: 'station-meridian', description: '', ownerId } })
    expectSuccess(runSeed({ SEED_ALLOW_ERASE: '1', SEED_EMAIL: OWNER, SEED_PASSWORD: PASSWORD, SEED_REPLACE_BY_SLUG: '1' }))
    expect(await prisma.game.findUnique({ where: { id: legacy.id } })).toBeNull()
  })

  it('crée les jeux à la propriétaire, avec des dates à venir', async () => {
    expectSuccess(runSeed())
    const games = await prisma.game.findMany({ where: { id: { in: GAME_IDS } }, select: { ownerId: true } })
    expect(games).toEqual(GAME_IDS.map(() => ({ ownerId })))

    const scheduled = await prisma.session.findMany({ where: { gameId: { in: GAME_IDS }, status: 'scheduled' }, select: { date: true } })
    expect(scheduled.length).toBeGreaterThan(0)
    for (const { date } of scheduled) expect(date!.getTime()).toBeGreaterThan(Date.now())
  })

  it('écrit les photos avec leur taille, sur le disque', async () => {
    const photos = await prisma.uploadedFile.findMany({ where: { gameId: { in: GAME_IDS } }, select: { filename: true, size: true } })
    expect(photos.length).toBeGreaterThan(0)
    for (const photo of photos) {
      expect(photo.size).toBeGreaterThan(0)
      expect(existsSync(join(process.cwd(), '.data', 'uploads', 'session-assignment-photos', photo.filename))).toBe(true)
    }
  })

  it('n\'envoie les adresses vers la boîte de la propriétaire que pour les personnes prévues', async () => {
    const fiches = await prisma.participant.findMany({
      where: { gameLinks: { some: { gameId: { in: GAME_IDS } } } },
      select: { email: true }
    })
    const receiving = fiches.map((fiche) => fiche.email!).filter((email) => !email.endsWith('@example.test') || email.includes('+'))
    expect(new Set(receiving)).toEqual(new Set(
      ['ines.lefevre', 'camille.bernard', 'lucie.moreau', 'nicolas.martin', 'sarah.petit', 'manon.richard'].map(plusAddress)
    ))
  })

  it('donne des comptes de test prêts à l\'emploi, rattachés à leur fiche', async () => {
    for (const localPart of ['ines.lefevre', 'camille.bernard', 'lucie.moreau']) {
      const email = plusAddress(localPart)
      const login = await api(null, 'POST', '/api/auth/login', { email, password: PASSWORD })
      expect(login.status, JSON.stringify(login.body)).toBe(200)

      const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, name: true, phone: true, role: true, emailConfirmedAt: true, termsAcceptedAt: true } })
      expect(user.role).toBe('user')
      expect(user.emailConfirmedAt).not.toBeNull()
      expect(user.termsAcceptedAt).not.toBeNull()
      expect(await prisma.participant.count({ where: { email, userId: user.id, name: user.name, phone: user.phone } })).toBeGreaterThan(0)
    }
  })

  it('fait co-organiser deux jeux à Inès, et pas le troisième', async () => {
    const ines = await prisma.user.findUniqueOrThrow({ where: { email: plusAddress('ines.lefevre') }, select: { id: true } })
    const shares = await prisma.gameShare.findMany({ where: { userId: ines.id }, select: { gameId: true } })
    expect(shares.map((share) => share.gameId).sort()).toEqual(['jeu-test-meridian', 'jeu-test-valombre'])
  })

  it('garde ce qui est hors des jeux de test, et les accès aux jeux rechargés', async () => {
    // Témoins : un jeu étranger, une fiche partagée avec lui, une fiche propre à lui
    const other = await prisma.game.create({ data: { title: 'Jeu témoin', slug: 'jeu-temoin-seed', description: '', ownerId } })
    const shared = await prisma.participant.create({
      data: { name: 'Fiche partagée', slug: 'fiche-partagee-seed', gameLinks: { create: [{ gameId: other.id }, { gameId: 'jeu-test-bal' }] } }
    })
    const own = await prisma.participant.create({
      data: { name: 'Fiche étrangère', slug: 'fiche-etrangere-seed', gameLinks: { create: [{ gameId: other.id }] } }
    })
    const bystander = await prisma.user.create({ data: { email: 'seed-temoin@example.test', name: 'Témoin', password: 'x' } })
    await prisma.gameShare.create({ data: { gameId: 'jeu-test-bal', userId: bystander.id } })

    const client = await prisma.aiClient.create({ data: { id: 'assistant-temoin-seed', name: 'Assistant témoin', redirectUris: ['https://exemple.test/retour'] } })
    const authorization = await prisma.aiAuthorization.create({
      data: { userId: ownerId, clientId: client.id, sessionVersion: 0, games: { create: { gameId: 'jeu-test-bal' } } }
    })

    // Une copie acceptée reste à sa destinataire ; une copie en attente part
    const accepted = await prisma.game.create({ data: { title: 'Copie acceptée', slug: 'copie-acceptee-seed', description: '', ownerId: bystander.id, copiedFromGameId: 'jeu-test-bal' } })
    const pending = await prisma.game.create({ data: { title: 'Copie en attente', slug: 'copie-attente-seed', description: '', copiedFromGameId: 'jeu-test-bal', bequestPending: true } })

    // Un jeu renommé reste reconnu
    await prisma.game.update({ where: { id: 'jeu-test-meridian' }, data: { title: 'Meridian renommé', slug: 'meridian-renomme-seed' } })

    // Un fichier ajouté pendant les essais quitte le disque
    const photoDir = join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')
    await mkdir(photoDir, { recursive: true })
    const addedPath = join(photoDir, 'ajout-pendant-les-essais.png')
    await writeFile(addedPath, 'photo')
    const addedUrl = '/api/uploads/session-assignment-photos/ajout-pendant-les-essais.png'
    await prisma.uploadedFile.create({ data: { kind: 'session-assignment-photo', filename: 'ajout-pendant-les-essais.png', url: addedUrl, gameId: 'jeu-test-bal', size: 5 } })

    const countsBefore = await seedCounts()
    expectSuccess(runSeed())

    expect(await prisma.game.findUnique({ where: { id: other.id } })).not.toBeNull()
    expect(await prisma.participant.findUnique({ where: { id: shared.id } })).not.toBeNull()
    expect(await prisma.participant.findUnique({ where: { id: own.id } })).not.toBeNull()
    expect(await prisma.gameShare.count({ where: { gameId: 'jeu-test-bal', userId: bystander.id } })).toBe(1)
    expect(await prisma.aiAuthorizationGame.count({ where: { authorizationId: authorization.id, gameId: 'jeu-test-bal' } })).toBe(1)

    expect((await prisma.game.findUniqueOrThrow({ where: { id: accepted.id } })).ownerId).toBe(bystander.id)
    expect(await prisma.game.findUnique({ where: { id: pending.id } })).toBeNull()

    const meridian = await prisma.game.findUniqueOrThrow({ where: { id: 'jeu-test-meridian' } })
    expect(meridian.slug).toBe('station-meridian')
    expect(await prisma.game.count({ where: { title: 'Station Meridian' } })).toBe(1)

    expect(existsSync(addedPath)).toBe(false)
    expect(await prisma.uploadedFile.count({ where: { url: addedUrl } })).toBe(0)

    // Le second rechargement donne le même contenu
    expect(await seedCounts()).toEqual(countsBefore)

    await prisma.game.deleteMany({ where: { id: { in: [other.id, accepted.id] } } })
    await prisma.participant.deleteMany({ where: { id: { in: [shared.id, own.id] } } })
    await prisma.user.delete({ where: { id: bystander.id } })
    await prisma.aiClient.delete({ where: { id: client.id } })
  })

  it('sans mot de passe, ne modifie aucun compte de test, et garde les fiches rattachées', async () => {
    const email = plusAddress('camille.bernard')
    const before = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, password: true, sessionVersion: true } })
    expectSuccess(runSeed({ SEED_ALLOW_ERASE: '1', SEED_EMAIL: OWNER }))
    expect(await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, password: true, sessionVersion: true } })).toEqual(before)
    expect(await prisma.participant.count({ where: { email, userId: before.id } })).toBeGreaterThan(0)
  })

  it('coupe les sessions ouvertes quand le mot de passe est remis à neuf', async () => {
    const email = plusAddress('camille.bernard')
    const before = await prisma.user.findUniqueOrThrow({ where: { email }, select: { sessionVersion: true } })
    expectSuccess(runSeed())
    const after = await prisma.user.findUniqueOrThrow({ where: { email }, select: { sessionVersion: true } })
    expect(after.sessionVersion).toBe(before.sessionVersion + 1)
  })

  it('un échec au milieu laisse les jeux et leurs accès tels quels', async () => {
    // Une adresse de document prise fait échouer la création du dernier jeu, après toutes les suppressions
    const other = await prisma.game.create({ data: { title: 'Jeu bloquant', slug: 'jeu-bloquant-seed', description: '', ownerId } })
    await prisma.document.create({
      data: { title: 'Bloquant', slug: 'feuille-de-route-le-bal-des-masques-brises-seed', content: '', gameId: other.id }
    })
    await prisma.document.updateMany({ where: { gameId: 'jeu-test-bal' }, data: { title: 'Titre gardé' } })
    await prisma.document.updateMany({ where: { gameId: 'jeu-test-bal', slug: 'feuille-de-route-le-bal-des-masques-brises' }, data: { slug: 'feuille-de-route-renommee-seed' } })
    await prisma.document.update({ where: { slug: 'feuille-de-route-le-bal-des-masques-brises-seed' }, data: { slug: 'feuille-de-route-le-bal-des-masques-brises' } })

    const run = runSeed({ SEED_ALLOW_ERASE: '1', SEED_EMAIL: OWNER })
    expect(run.status).not.toBe(0)
    expect(await prisma.document.count({ where: { gameId: 'jeu-test-bal', title: 'Titre gardé' } })).toBeGreaterThan(0)

    await prisma.game.delete({ where: { id: other.id } })
    expectSuccess(runSeed())
  })

  it('sans adresse, prend le premier compte hors comptes de test, et ne dirige aucune adresse vers une vraie boîte', async () => {
    expectSuccess(runSeed({ SEED_ALLOW_ERASE: '1', SEED_PASSWORD: PASSWORD }))
    expectSuccess(runSeed({ SEED_ALLOW_ERASE: '1', SEED_PASSWORD: PASSWORD }))

    const games = await prisma.game.findMany({ where: { id: { in: GAME_IDS } }, select: { owner: { select: { email: true } } } })
    for (const game of games) {
      expect(game.owner).not.toBeNull()
      expect(game.owner!.email).not.toMatch(/^(ines\.lefevre|camille\.bernard|lucie\.moreau)@/)
    }

    const fiches = await prisma.participant.findMany({
      where: { gameLinks: { some: { gameId: { in: GAME_IDS } } } },
      select: { email: true }
    })
    for (const { email } of fiches) expect(email).toMatch(/^[^+]+@example\.test$/)
    const camille = await prisma.user.findUniqueOrThrow({ where: { email: 'camille.bernard@example.test' }, select: { id: true } })
    expect(await prisma.participant.count({ where: { email: 'camille.bernard@example.test', userId: camille.id } })).toBeGreaterThan(0)
  })
})

async function seedCounts() {
  const where = { gameId: { in: GAME_IDS } }
  return {
    games: await prisma.game.count({ where: { id: { in: GAME_IDS } } }),
    characters: await prisma.character.count({ where }),
    sessions: await prisma.session.count({ where }),
    documents: await prisma.document.count({ where })
  }
}
