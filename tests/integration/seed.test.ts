// US-150, US-151 : rechargement des jeux de test (ADR-0066). Le script tourne sur la base de test,
// avec un compte propriétaire propre à ce fichier ; le reste de la base sert de témoin.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import bcrypt from 'bcrypt'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { registrationFormDefinitionSchema } from '~/server/utils/schemas'
import { MERIDIAN_FORM_DEFINITIONS } from '../../prisma/seed/meridian'
import { api, bodyOf } from './api'
import { createTestPrisma, testDatabaseUrl } from './db'
import { startTestSmtp } from './smtp'

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

async function removeSeedGames() {
  await prisma.participant.deleteMany({ where: { gameLinks: { some: { gameId: { in: GAME_IDS } } } } })
  await prisma.game.deleteMany({ where: { OR: [{ id: { in: GAME_IDS } }, { copiedFromGameId: { in: GAME_IDS } }] } })
}

function expectSuccess(run: ReturnType<typeof runSeed>) {
  expect(run.status, run.output).toBe(0)
}

function plusAddress(localPart: string) {
  return `seed-proprietaire+${localPart}@example.test`
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('rechargement des jeux de test', () => {
  let ownerId: string

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { email: OWNER, name: 'Propriétaire des essais', password: await bcrypt.hash(PASSWORD, 4) }
    })
    ownerId = owner.id
  })

  afterAll(async () => {
    await removeSeedGames()
    await prisma.user.deleteMany({ where: { email: { startsWith: 'seed-proprietaire' } } })
    await prisma.user.deleteMany({ where: { email: { in: ['ines.lefevre@example.test', 'camille.bernard@example.test', 'lucie.moreau@example.test'] } } })
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
    // Les 8 personnes du casting de chaque jeu, et pas les fiches ajoutées à Station Meridian
    expect(photos.length).toBe(24)
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

  it('fait passer tout joueur par le vivier : sa place dans la session est écrite (R31)', async () => {
    const players = await prisma.sessionParticipant.findMany({ where: { role: 'participant', session: { gameId: { in: GAME_IDS } } }, select: { sessionId: true, participantId: true, session: { select: { gameId: true } } } })
    expect(players.length).toBeGreaterThan(0)
    for (const { sessionId, participantId, session } of players) {
      const registration = await prisma.registration.findFirst({
        where: { participantId, period: { gameId: session.gameId } },
        select: { status: true, sessionLines: { where: { sessionId }, select: { status: true } } }
      })
      expect(registration).toBeTruthy()
      // Une personne sortie depuis du vivier garde seulement sa réponse
      if (registration?.status === 'received') expect(['confirmed', 'transferred']).toContain(registration.sessionLines[0]?.status)
    }
  })

  it('reprend les allergies du compte dans les réponses du vivier fermé (fiche allergies)', async () => {
    const registrations = await prisma.registration.findMany({
      where: { period: { gameId: 'jeu-test-valombre' } },
      select: { dietary: true, formVersionId: true, participant: { select: { user: { select: { dietary: true } } } } }
    })
    expect(registrations.length).toBeGreaterThan(0)
    for (const { dietary, formVersionId, participant } of registrations) {
      expect(dietary).toBe(participant.user?.dietary ?? null)
      // Sans version, la réponse ne suit plus le compte
      expect(formVersionId).toBeTruthy()
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
    await prisma.uploadedFile.create({ data: { kind: 'sessionAssignmentPhoto', filename: 'ajout-pendant-les-essais.png', url: addedUrl, gameId: 'jeu-test-bal', size: 5 } })

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

    // Une seule fiche par personne pour les trois jeux (US-185) : Lucie est sur les trois
    const emails = fiches.map(({ email }) => email)
    expect(new Set(emails).size).toBe(emails.length)
    const lucie = await prisma.participant.findFirstOrThrow({ where: { email: 'lucie.moreau@example.test' }, select: { _count: { select: { gameLinks: true } } } })
    expect(lucie._count.gameLinks).toBe(3)
  })
})

describe('Station Meridian, avant les sessions', () => {
  const meridian = 'jeu-test-meridian'
  let owner: { id: string }

  beforeAll(async () => {
    owner = await prisma.user.create({ data: { email: 'meridian-proprietaire@example.test', name: 'Propriétaire', password: await bcrypt.hash(PASSWORD, 4) } })
    expectSuccess(runSeed({ SEED_ALLOW_ERASE: '1', SEED_EMAIL: 'meridian-proprietaire@example.test', SEED_PASSWORD: PASSWORD }))
  })

  afterAll(async () => {
    await removeSeedGames()
    await prisma.user.deleteMany({ where: { email: { startsWith: 'meridian-proprietaire' } } })
  })

  it('a des définitions de formulaire que le serveur accepte', () => {
    for (const definition of MERIDIAN_FORM_DEFINITIONS) {
      expect(registrationFormDefinitionSchema.safeParse(definition).success).toBe(true)
    }
  })

  it('montre une page publique qui annonce un jeu d\'essai, sans prévenir l\'équipe', async () => {
    const page = await api(null, 'GET', '/api/public/games/station-meridian')
    expect(page.status, JSON.stringify(page.body)).toBe(200)
    expect(JSON.stringify(page.body)).toContain('Jeu d’essai')
    expect(JSON.stringify(page.body)).toContain('/i/essai-meridian-vivier')

    const form = await api(null, 'GET', '/api/public/periods/essai-meridian-vivier')
    expect(form.status, JSON.stringify(form.body)).toBe(200)
    expect(JSON.stringify(form.body)).toContain('Quel type de rôle préférez-vous ?')
    expect(await prisma.registrationPeriod.count({ where: { gameId: meridian, notifyTeam: true } })).toBe(0)
  })

  it('a un seul vivier, ouvert, et chaque sorte de session', async () => {
    const period = await prisma.registrationPeriod.findUniqueOrThrow({
      where: { gameId: meridian },
      select: { state: true, sessions: { select: { open: true, selectionMode: true } } }
    })
    expect(period.state).toBe('open')
    const has = (fields: Partial<typeof period.sessions[number]>) => period.sessions.some((link) => Object.entries(fields).every(([key, value]) => link[key as keyof typeof link] === value))
    expect(has({ selectionMode: 'chosen', open: true })).toBe(true)
    expect(has({ selectionMode: 'random', open: false })).toBe(true)
    expect(has({ selectionMode: 'mixed', open: true })).toBe(true)
    expect(has({ selectionMode: 'chosen', open: false })).toBe(true)
  })

  it('a chaque statut, pour le jeu et par session, avec des décisions annoncées et d\'autres à annoncer', async () => {
    const people = await prisma.registration.findMany({ where: { period: { gameId: meridian } }, select: { status: true } })
    expect(new Set(people.map((row) => row.status))).toEqual(new Set(['invited', 'received', 'withdrawn']))
    const rows = await prisma.registrationSession.findMany({ where: { registration: { period: { gameId: meridian } } }, select: { status: true, announcedStatus: true } })
    expect(new Set(rows.map((row) => row.status))).toEqual(new Set(['preregistered', 'unavailable', 'waitlisted', 'retained', 'confirmed', 'cancelled']))
    expect(rows.some((row) => row.status === 'retained' && row.announcedStatus === 'retained')).toBe(true)
    expect(rows.some((row) => row.status === 'retained' && !row.announcedStatus)).toBe(true)
  })

  it('a une session à annoncer, et une session annoncée avec des emails à proposer (R26, R27)', async () => {
    const links = await prisma.registrationPeriodSession.findMany({
      where: { period: { gameId: meridian }, session: { status: 'scheduled' } },
      select: { castAnnouncedAt: true, session: { select: { registrationLines: { select: { status: true, announcedStatus: true } } } } }
    })
    const pending = (link: typeof links[number]) => link.session.registrationLines.some((line) => line.status === 'retained' && line.announcedStatus !== 'retained')
    expect(links.some((link) => !link.castAnnouncedAt && pending(link))).toBe(true)
    expect(links.some((link) => link.castAnnouncedAt && pending(link))).toBe(true)
  })

  it('a une inscrite validée et une inscrite pas encore validée (R18)', async () => {
    const periods = bodyOf<ApiResponse<'/api/registration-periods'>>(await api(owner, 'GET', `/api/registration-periods?gameId=${meridian}`))
    const confirmed = periods[0]!.registrations.flatMap((registration) => registration.sessionLines).filter((line) => line.status === 'confirmed')
    expect(confirmed.some((line) => line.validated)).toBe(true)
    expect(confirmed.some((line) => !line.validated)).toBe(true)
  })

  it('a une personne castée dont les réponses ont changé (R16)', async () => {
    expect(await prisma.registrationSession.count({ where: { registration: { period: { gameId: meridian } }, answersChangedAt: { not: null } } })).toBe(1)
  })

  it('a une session déjà demandée au vivier, à relancer (R12)', async () => {
    expect(await prisma.registrationPeriodSession.count({ where: { period: { gameId: meridian }, open: true, lastRequestedAt: { not: null } } })).toBe(1)
  })

  it('montre la sélection, avec ses alertes et sa rejoueuse', async () => {
    const period = await prisma.registrationPeriod.findUniqueOrThrow({ where: { gameId: meridian }, select: { id: true } })
    const selection = await api(owner, 'GET', `/api/registration-periods/${period.id}/selection`)
    expect(selection.status, JSON.stringify(selection.body)).toBe(200)
    const body = bodyOf<ApiResponse<'/api/registration-periods/:id/selection'>>(selection)
    const amandine = await prisma.participant.findFirstOrThrow({ where: { email: 'amandine.blanc@example.test', gameLinks: { some: { gameId: meridian } } }, select: { id: true } })
    expect(body.replayerParticipantIds).toContain(amandine.id)
    expect(body.affinities.alerts.map((alert) => [alert.participantName, alert.targetName])).toEqual([['Nicolas Martin', 'Raphaël Chevalier']])
    expect(Object.keys(body.affinities.wishes).length).toBeGreaterThan(0)
    expect(Object.keys(body.affinities.toLink).length).toBeGreaterThan(0)
  })

  it('a un tirage reproductible et annulable', async () => {
    const period = await prisma.registrationPeriod.findUniqueOrThrow({ where: { gameId: meridian }, select: { id: true } })
    const draws = await api(owner, 'GET', `/api/registration-periods/${period.id}/draws`)
    expect(draws.status, JSON.stringify(draws.body)).toBe(200)
    expect(JSON.stringify(draws.body)).toContain('graine-du-jeu-de-test')

    const draw = await prisma.registrationDraw.findFirstOrThrow({ where: { periodId: period.id }, select: { id: true, sessionId: true } })
    const where = { sessionId: draw.sessionId!, status: 'retained' as const }
    expect(await prisma.registrationSession.count({ where })).toBe(6)
    const cancelled = await api(owner, 'POST', `/api/registration-draws/${draw.id}/cancel`)
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200)
    expect(await prisma.registrationSession.count({ where })).toBe(0)
  })

  it('donne des repères de qualité et une estimation sur le questionnaire', async () => {
    const quality = await api(owner, 'GET', `/api/games/${meridian}/registration-form-quality`)
    expect(quality.status, JSON.stringify(quality.body)).toBe(200)
    const body = bodyOf<ApiResponse<'/api/games/:id/registration-form-quality'>>(quality)
    expect(body.hasAnswers).toBe(true)
    expect(body.respondentCount).toBeGreaterThanOrEqual(40)
    expect(body.characterCount).toBe(6)
    expect(body.estimate).not.toBeNull()
    expect(body.drafting.questions.length).toBeGreaterThan(0)
    for (const kind of ['dominantAnswer', 'duplicateQuestions', 'indistinctCharacters']) {
      expect(body.findings.map((finding) => finding.kind)).toContain(kind)
    }
  })

  it('propose une distribution avec l\'assistant de casting', async () => {
    const session = await prisma.session.findFirstOrThrow({ where: { gameId: meridian, name: { contains: 'à la main' } }, select: { id: true } })
    const casting = await api(owner, 'POST', `/api/sessions/${session.id}/casting-assistant`, { assignments: [] })
    expect(casting.status, JSON.stringify(casting.body)).toBe(200)
    expect(JSON.stringify(casting.body)).toContain('Lucie')
  })

  it('montre à Camille une session à venir et une inscription en cours dans deux jeux', async () => {
    const account = await prisma.user.findUniqueOrThrow({ where: { email: 'meridian-proprietaire+camille.bernard@example.test' }, select: { id: true } })
    const space = await api(account, 'GET', '/api/me/participations')
    expect(space.status, JSON.stringify(space.body)).toBe(200)
    const text = JSON.stringify(space.body)
    expect(text).toContain('Station Meridian')
    expect(text).toContain('Les Cendres de Valombre')
  })

  it('donne à Inès ses jeux partagés, et lui refuse le troisième', async () => {
    const ines = await prisma.user.findUniqueOrThrow({ where: { email: 'meridian-proprietaire+ines.lefevre@example.test' }, select: { id: true } })
    expect((await api(ines, 'GET', `/api/games/${meridian}`)).status).toBe(200)
    expect((await api(ines, 'GET', '/api/games/jeu-test-valombre')).status).toBe(200)
    expect([403, 404]).toContain((await api(ines, 'GET', '/api/games/jeu-test-bal')).status)
  })

  it('montre à chacune sa décision annoncée, jamais une décision non annoncée', async () => {
    const spaceOf = async (localPart: string) => {
      const account = await prisma.user.findUniqueOrThrow({ where: { email: `meridian-proprietaire+${localPart}@example.test` }, select: { id: true } })
      return JSON.stringify((await api(account, 'GET', '/api/me/participations')).body)
    }
    expect(await spaceOf('lucie.moreau')).toContain('retained')
    expect(await spaceOf('camille.bernard')).not.toContain('retained')
  })
})

describe('Les Cendres de Valombre, session imminente', () => {
  const valombre = 'jeu-test-valombre'
  let owner: { id: string }
  let sessionId: string

  const accountOf = (localPart: string) => prisma.user.findUniqueOrThrow({ where: { email: `valombre-proprietaire+${localPart}@example.test` }, select: { id: true } })
  const ficheOf = (localPart: string) => prisma.participant.findFirstOrThrow({
    where: { email: `valombre-proprietaire+${localPart}@example.test`, gameLinks: { some: { gameId: valombre } } },
    select: { id: true }
  })

  beforeAll(async () => {
    owner = await prisma.user.create({ data: { email: 'valombre-proprietaire@example.test', name: 'Propriétaire', password: await bcrypt.hash(PASSWORD, 4) } })
    expectSuccess(runSeed({ SEED_ALLOW_ERASE: '1', SEED_EMAIL: 'valombre-proprietaire@example.test', SEED_PASSWORD: PASSWORD }))
    const session = await prisma.session.findFirstOrThrow({ where: { gameId: valombre, name: { contains: 'imminente' } }, select: { id: true, date: true } })
    sessionId = session.id
    const days = (session.date!.getTime() - Date.now()) / (24 * 3600 * 1000)
    expect(days).toBeGreaterThan(8)
    expect(days).toBeLessThan(11)
  })

  afterAll(async () => {
    await removeSeedGames()
    await prisma.user.deleteMany({ where: { email: { startsWith: 'valombre-proprietaire' } } })
  })

  it('a un casting presque complet, avec un rôle libre et une équipe', async () => {
    const rows = await prisma.sessionAssignment.findMany({ where: { sessionId }, select: { participantId: true, photoUrl: true } })
    expect(rows.filter((row) => !row.participantId)).toHaveLength(1)
    expect(rows.filter((row) => row.photoUrl)).toHaveLength(7)
    const team = await prisma.sessionParticipant.findMany({ where: { sessionId }, select: { role: true } })
    expect(new Set(team.map((row) => row.role))).toEqual(new Set(['participant', 'organizer', 'npc', 'kitchen']))
  })

  it('lit des paiements dans chaque situation, et son RIB', async () => {
    const response = await api(owner, 'GET', `/api/sessions/${sessionId}/payments`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const rows = await prisma.sessionPayment.findMany({ where: { sessionId }, select: { paidAt: true, offered: true, transferredToParticipantId: true, instalments: { select: { id: true } } } })
    expect(rows.some((row) => row.paidAt)).toBe(true)
    expect(rows.some((row) => !row.paidAt && !row.offered && !row.instalments.length)).toBe(true)
    expect(rows.some((row) => row.instalments.length === 2)).toBe(true)
    expect(rows.some((row) => row.offered)).toBe(true)
    expect(rows.some((row) => row.transferredToParticipantId)).toBe(true)
    expect(await prisma.sessionTariff.count({ where: { sessionId, baseTariffId: { not: null } } })).toBe(2)
    expect(JSON.stringify(response.body)).toContain('Antoine Durand')
    const body = bodyOf<ApiResponse<'/api/sessions/:id/payments'>>(response)
    const row = (name: string) => body.rows.find((line) => line.participant.name === name)!
    expect(row('Lucie Moreau').receivedCents).toBe(8000)
    expect(row('Lucie Moreau').dueCents).toBe(12000)
    expect(row('Sarah Petit').dueCents).toBe(0)
    expect(row('Nicolas Martin').dueCents).toBe(9000)

    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, select: { paymentRibUrl: true } })
    expect(existsSync(join(process.cwd(), '.data', 'uploads', 'session-payment-ribs', session.paymentRibUrl!.split('/').pop()!))).toBe(true)
    const file = await prisma.uploadedFile.findUniqueOrThrow({ where: { url: session.paymentRibUrl! }, select: { size: true } })
    expect(file.size).toBeGreaterThan(0)
    expect((await api(owner, 'GET', session.paymentRibUrl!)).status).toBe(200)
    const photo = await prisma.sessionAssignment.findFirstOrThrow({ where: { sessionId, photoUrl: { not: null } }, select: { photoUrl: true } })
    expect((await api(owner, 'GET', photo.photoUrl!)).status).toBe(200)
  })

  it('lit la présence, avec chaque réponse et un délai dépassé', async () => {
    const response = await api(owner, 'GET', `/api/sessions/${sessionId}/attendance`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const body = bodyOf<ApiResponse<'/api/sessions/:id/attendance'>>(response)
    expect(body.postponedFrom?.name).toContain('Session reportée')
    expect(new Set(body.rows.map((row) => row.status))).toEqual(new Set(['pending', 'confirmed', 'declined']))
    const julien = body.rows.find((row) => row.participant.name === 'Julien Robert')!
    expect(julien.displayStatus).not.toBe(julien.status)
    expect(body.rows.every((row) => row.invitationSentAt)).toBe(true)
  })

  it('envoie une demande de présence à Nicolas et à Inès seulement, avec un lien qui marche', async () => {
    const smtp = await startTestSmtp(prisma)
    try {
      const responseDueAt = new Date(Date.now() + 5 * 86_400_000).toISOString()
      const sent = await api(owner, 'POST', `/api/sessions/${sessionId}/attendance/send`, { responseDueAt })
      expect(sent.status, JSON.stringify(sent.body)).toBe(200)
      expect(smtp.received.map((email) => email.to).flat().sort()).toEqual([
        'valombre-proprietaire+ines.lefevre@example.test',
        'valombre-proprietaire+nicolas.martin@example.test'
      ])
      const token = smtp.received[0]!.text.match(/\/presence\/([\w-]+)/)?.[1]
      expect((await api(null, 'GET', `/api/public/attendance/${token}`)).status).toBe(200)
    } finally {
      await smtp.stop()
    }
  })

  it('distingue un envoi à jour d\'un envoi dépassé', async () => {
    const response = await api(owner, 'GET', `/api/sessions/${sessionId}/documents`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const body = bodyOf<ApiResponse<'/api/sessions/:id/documents'>>(response)
    const recipients = (start: string) => body.documents.find((document) => document.title.startsWith(start))!.recipients
    const sent = (start: string) => recipients(start).filter((recipient) => recipient.sentAt)
    expect(sent('Feuille de route').length).toBe(3)
    expect(sent('Feuille de route').every((recipient) => !recipient.versionOutdated)).toBe(true)
    expect(sent('Document monde').length).toBe(3)
    expect(sent('Document monde').every((recipient) => recipient.versionOutdated)).toBe(true)
    const sheet = body.characterSheets.find((row) => row.character.name === 'Aélis de Valombre')!
    expect(sheet.sentAt).not.toBeNull()
    expect(sheet.sheetVersionOutdated).toBe(false)
    expect(sheet.trombinoscopeOutdated).toBe(true)
  })

  it('signale les conflits et les responsables manquants du déroulé', async () => {
    const response = await api(owner, 'GET', `/api/sessions/${sessionId}/timeline`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(JSON.stringify(response.body)).toContain('Thomas Garnier')
  })

  it('montre à Camille sa session, ses documents, son trombinoscope et son paiement', async () => {
    const camille = await accountOf('camille.bernard')
    const space = await api(camille, 'GET', '/api/me/participations')
    expect(space.status, JSON.stringify(space.body)).toBe(200)
    const text = JSON.stringify(space.body)
    for (const expected of ['Session imminente', 'Aélis de Valombre', 'Feuille de route', 'Tarif de soutien']) expect(text).toContain(expected)

    const fiche = await ficheOf('camille.bernard')
    const deliveries = await prisma.sessionDocumentDelivery.findMany({ where: { sessionId, participantId: fiche.id }, select: { id: true, kind: true } })
    expect(new Set(deliveries.map((row) => row.kind))).toEqual(new Set(['document', 'character_sheet', 'trombinoscope']))
    for (const delivery of deliveries) {
      const read = await api(camille, 'GET', `/api/me/documents/${delivery.id}`)
      expect(read.status, JSON.stringify(read.body)).toBe(200)
      expect(bodyOf<{ source: string | null }>(read).source, delivery.kind).not.toBeNull()
      expect((await api(camille, 'GET', `/api/me/documents/${delivery.id}/pdf`)).status, delivery.kind).toBe(200)
    }
  })

  it('exporte une fiche, puis l\'efface sans erreur', async () => {
    const fiche = await ficheOf('nicolas.martin')
    const exported = await api(owner, 'GET', `/api/participants/${fiche.id}/export`)
    expect(exported.status, JSON.stringify(exported.body)).toBe(200)
    expect(JSON.stringify(exported.body)).toContain('Tarif réduit')
    const erased = await api(owner, 'DELETE', `/api/participants/${fiche.id}`)
    expect(erased.status, JSON.stringify(erased.body)).toBe(200)
    expect(await prisma.participant.findUnique({ where: { id: fiche.id } })).toBeNull()
  })

  it('garde des notes propres à chaque jeu, pour une personne présente sur plusieurs jeux', async () => {
    const camille = await ficheOf('camille.bernard')
    const link = await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: camille.id, gameId: valombre } }, select: { notes: true } })
    expect(link.notes).toContain('covoiturage')
    const other = await prisma.participantGame.findFirstOrThrow({ where: { participant: { email: `valombre-proprietaire+camille.bernard@example.test` }, gameId: 'jeu-test-meridian' }, select: { notes: true } })
    expect(other.notes).toBeNull()

    const morgan = await prisma.participant.findFirstOrThrow({ where: { email: 'morgan.dasilva@example.test' }, select: { gameLinks: { select: { gameId: true } } } })
    expect(morgan.gameLinks.map((row) => row.gameId).sort()).toEqual([...GAME_IDS].sort())
  })

  it('laisse les co-organisatrices y brancher un assistant', async () => {
    const game = await prisma.game.findUniqueOrThrow({ where: { id: valombre }, select: { aiForCoorganizers: true } })
    expect(game.aiForCoorganizers).toBe(true)
    expect((await api(await accountOf('ines.lefevre'), 'GET', `/api/sessions/${sessionId}/payments`)).status).toBe(200)
  })
})

describe('Le Bal des Masques Brisés, après et imprévus', () => {
  const bal = 'jeu-test-bal'
  let owner: { id: string }
  const OWNER_EMAIL = 'bal-proprietaire@example.test'
  const reload = () => expectSuccess(runSeed({ SEED_ALLOW_ERASE: '1', SEED_EMAIL: OWNER_EMAIL, SEED_PASSWORD: PASSWORD }))
  const sessionNamed = (name: string) => prisma.session.findFirstOrThrow({ where: { gameId: bal, name: { contains: name } }, select: { id: true, status: true, postponedToSessionId: true } })

  beforeAll(async () => {
    owner = await prisma.user.create({ data: { email: OWNER_EMAIL, name: 'Propriétaire', password: await bcrypt.hash(PASSWORD, 4) } })
    reload()
  })

  afterAll(async () => {
    await removeSeedGames()
    await prisma.user.deleteMany({ where: { email: { startsWith: 'bal-proprietaire' } } })
  })

  it('a une session terminée récente, avec son casting et ses photos', async () => {
    const session = await prisma.session.findFirstOrThrow({ where: { gameId: bal, status: 'completed' }, select: { date: true, assignments: { select: { photoUrl: true } } } })
    expect(session.date!.getTime()).toBeLessThan(Date.now())
    expect(session.date!.getTime()).toBeGreaterThan(Date.now() - 120 * 86_400_000)
    expect(session.assignments.every((row) => row.photoUrl)).toBe(true)
  })

  it('lit les remboursements d\'une session annulée', async () => {
    const session = await sessionNamed('annulée')
    expect(session.status).toBe('cancelled')
    const body = bodyOf<ApiResponse<'/api/sessions/:id/payments'>>(await api(owner, 'GET', `/api/sessions/${session.id}/payments`))
    expect(body.refunds.map((row) => row.refundStatus).sort()).toEqual(['refunded', 'to_refund'])
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id } })).toBe(2)
  })

  it('renvoie une session reportée à sa nouvelle session, avec un paiement reporté', async () => {
    const session = await sessionNamed('Session reportée')
    expect(session.status).toBe('postponed')
    const replacement = await sessionNamed('remplacement')
    expect(session.postponedToSessionId).toBe(replacement.id)
    const body = bodyOf<ApiResponse<'/api/sessions/:id/payments'>>(await api(owner, 'GET', `/api/sessions/${session.id}/payments`))
    expect(body.refunds.map((row) => row.refundStatus).sort()).toEqual(['carried_over', 'to_refund'])
    expect(await prisma.sessionPayment.count({ where: { sessionId: session.id, carriedOverToSessionId: replacement.id } })).toBe(1)
  })

  it('a un refus de photo, et la durée de conservation du jeu', async () => {
    expect(await prisma.participant.count({ where: { photoRefusedAt: { not: null }, gameLinks: { some: { gameId: bal } } } })).toBe(1)
    const game = await prisma.game.findUniqueOrThrow({ where: { id: bal }, select: { photoRetentionMonths: true } })
    expect(game.photoRetentionMonths).toBeGreaterThan(0)
  })

  it('montre à Lucie la session terminée, et la version actuelle du document reçu', async () => {
    const lucie = await prisma.user.findUniqueOrThrow({ where: { email: 'bal-proprietaire+lucie.moreau@example.test' }, select: { id: true } })
    const space = await api(lucie, 'GET', '/api/me/participations')
    expect(JSON.stringify(space.body)).toContain('Session terminée')
    const delivery = await prisma.sessionDocumentDelivery.findFirstOrThrow({ where: { participant: { email: 'bal-proprietaire+lucie.moreau@example.test' }, session: { gameId: bal } }, select: { id: true } })
    const read = await api(lucie, 'GET', `/api/me/documents/${delivery.id}`)
    expect(read.status, JSON.stringify(read.body)).toBe(200)
    expect(bodyOf<{ source: string | null }>(read).source).toBe('current')
  })

  it('garde le contenu d\'origine, dont l\'intrigue sans rattachement', async () => {
    const orphan = await prisma.intrigue.findFirstOrThrow({ where: { gameId: bal, name: 'Le billet non signé' }, select: { characterLinks: true, factionLinks: true } })
    expect(orphan).toEqual({ characterLinks: [], factionLinks: [] })
    expect(await prisma.character.count({ where: { gameId: bal } })).toBe(8)
  })

  it('a un legs en attente que l\'application liste et sait renvoyer, et qu\'un rechargement remplace', async () => {
    const list = await api(owner, 'GET', `/api/games/${bal}/bequests`)
    expect(list.status, JSON.stringify(list.body)).toBe(200)
    const [bequest] = bodyOf<ApiResponse<'/api/games/:id/bequests'>>(list)
    expect(bequest!.email).toBe('bal-proprietaire+manon.richard@example.test')
    const pending = await prisma.game.findFirstOrThrow({
      where: { copiedFromGameId: bal, bequestPending: true },
      select: { creditAuthorName: true, _count: { select: { characters: true, documents: true } } }
    })
    expect(pending.creditAuthorName).toBe('Propriétaire')
    expect(pending._count.characters).toBeGreaterThan(0)
    expect(pending._count.documents).toBeGreaterThan(0)

    const smtp = await startTestSmtp(prisma)
    try {
      const resent = await api(owner, 'POST', `/api/games/${bal}/bequests/${bequest!.id}/resend`)
      expect(resent.status, JSON.stringify(resent.body)).toBe(200)
      expect(smtp.received.map((email) => email.to).flat()).toEqual(['bal-proprietaire+manon.richard@example.test'])
    } finally {
      await smtp.stop()
    }

    const before = await prisma.game.findFirstOrThrow({ where: { copiedFromGameId: bal, bequestPending: true }, select: { createdAt: true } })
    reload()
    const copies = await prisma.game.findMany({ where: { copiedFromGameId: bal, bequestPending: true }, select: { createdAt: true } })
    expect(copies).toHaveLength(1)
    expect(copies[0]!.createdAt.getTime()).toBeGreaterThan(before.createdAt.getTime())

    // Une copie acceptée garde son adresse de page, et le rechargement suivant réussit quand même
    await prisma.game.updateMany({ where: { copiedFromGameId: bal, bequestPending: true }, data: { bequestPending: false, ownerId: owner.id } })
    reload()
    expect(await prisma.game.count({ where: { slug: { startsWith: 'le-bal-des-masques-brises-copie-leguee' } } })).toBe(2)

    // Seule la copie numérotée reste : la suivante prend une adresse libre
    await prisma.game.deleteMany({ where: { slug: 'le-bal-des-masques-brises-copie-leguee' } })
    await prisma.game.updateMany({ where: { copiedFromGameId: bal, bequestPending: true }, data: { bequestPending: false, ownerId: owner.id } })
    reload()
    await prisma.game.deleteMany({ where: { slug: { startsWith: 'le-bal-des-masques-brises-copie-leguee' } } })
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
