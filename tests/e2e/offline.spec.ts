// EPIC-010 : déconnexion sans réseau (US-051), envoi de la file à l'ouverture (US-052) ;
// EPIC-011 : page de session hors ligne (US-057) ; EPIC-032 : page Inscriptions hors ligne (US-119, US-120)
import { expect, test, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { choose, expectLoggedIn, gamePanel, login, offlineRecordCount, openUserMenu, parcoursSession, signIn } from './helpers'

// File d'attente de l'appareil, lue ou écrite directement dans IndexedDB
async function writeQueue(page: Page, operations: unknown[]) {
  await page.evaluate((value) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('limbus-db')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('syncQueue', 'readwrite')
      tx.objectStore('syncQueue').put(value, 'operations')
      tx.oncomplete = () => { db.close(); resolve() }
    }
  }), operations)
}

async function readQueue(page: Page) {
  return await page.evaluate(() => new Promise<unknown[] | null>((resolve) => {
    const request = indexedDB.open('limbus-db')
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('syncQueue')) { db.close(); resolve(null); return }
      const get = db.transaction('syncQueue').objectStore('syncQueue').get('operations')
      get.onsuccess = () => { db.close(); resolve(get.result ?? null) }
    }
  }))
}

test('sans réseau, la déconnexion efface l’appareil et part au retour du réseau', async ({ page }) => {
  await login(page, E2E_USERS.orga)
  await expectLoggedIn(page)
  await page.goto('/games')
  await expect.poll(() => offlineRecordCount(page)).toBeGreaterThan(0)

  // Le serveur ne répond plus : la déconnexion ne peut pas partir
  await page.route('**/api/auth/logout', (route) => route.abort('internetdisconnected'))
  await openUserMenu(page)
  await page.getByRole('menuitem', { name: 'Déconnexion' }).click()

  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  expect(await offlineRecordCount(page)).toBe(0)
  expect(await page.evaluate(() => localStorage.getItem('limbusPendingLogout'))).toBe('true')

  // Retour du réseau : la déconnexion part, la session ne se rouvre pas
  await page.unroute('**/api/auth/logout')
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => page.evaluate(() => localStorage.getItem('limbusPendingLogout'))).toBeNull()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
})

test('les modifications en attente partent à l’ouverture de l’application', async ({ page }) => {
  await login(page, E2E_USERS.autre)
  await expectLoggedIn(page)
  const game = await (await page.request.post('/api/games', { data: { title: `Jeu hors ligne ${Date.now()}` }, headers: { 'sec-fetch-site': 'same-origin' } })).json()
  const name = `Clairière ${Date.now()}`
  // La page finit de s'ouvrir après la connexion : écrire avant ferait perdre le contexte de la page
  await page.waitForLoadState('networkidle')

  // Modification laissée en attente lors d'une visite précédente
  await writeQueue(page, [{
    id: 'op-ouverture',
    request: '/api/locations',
    method: 'POST',
    body: { name, gameId: game.id },
    store: 'locations',
    entityId: 'offline-ouverture',
    createdAt: new Date().toISOString(),
    status: 'pending'
  }])

  await page.reload()
  await expect.poll(async () => {
    const locations = await (await page.request.get('/api/locations')).json()
    return locations.some((location: { name: string }) => location.name === name)
  }).toBe(true)
  // La page peut naviguer pendant l'envoi de la file : une lecture interrompue est simplement refaite
  await expect.poll(() => readQueue(page).catch(() => 'page en cours de chargement')).toEqual([])
})

test('une session consultée se rouvre et se modifie sans réseau, puis la modification part', async ({ page, context }) => {
  const prisma = createTestPrisma()
  try {
    const { session, character, participant } = await parcoursSession(prisma, 'Session hors ligne e2e')
    // Déjà dans l'équipe de la session : elle reçoit son personnage
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant('Léa Parcours').id, role: 'participant' } })
    await signIn(page, prisma, E2E_USERS.orga)
    // Avec le réseau : la liste puis la session, gardées sur l'appareil
    await page.goto('/sessions')
    await page.waitForLoadState('networkidle')
    await page.goto(`/sessions/${session.slug}?tab=cast`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: session.name })).toBeVisible()

    // Sans réseau : retour à la liste, puis la session se rouvre depuis l'appareil
    await context.setOffline(true)
    await page.getByRole('link', { name: 'Sessions' }).first().click()
    await page.waitForURL('**/sessions')
    await page.goBack()
    await expect(page.getByRole('heading', { name: session.name })).toBeVisible()

    const row = page.locator('form > div.grid').filter({ hasText: 'Aube' })
    await choose(page, row.getByRole('combobox'), /Léa Parcours/)
    await page.getByRole('button', { name: 'Enregistrer le cast' }).click()
    await expect(page.getByText('Modifications faites hors ligne : 1 en attente.')).toBeVisible()
    await expect(row.getByRole('combobox')).toContainText('Léa Parcours')

    // Retour du réseau : la modification part
    await context.setOffline(false)
    await expect.poll(() => prisma.sessionAssignment.findFirst({
      where: { sessionId: session.id, characterId: character('Aube').id },
      select: { participantId: true }
    })).toEqual({ participantId: participant('Léa Parcours').id })
  } finally {
    await prisma.$disconnect()
  }
})


test('la page Inscriptions et une inscription consultée se relisent sans réseau', async ({ page, context }) => {
  const prisma = createTestPrisma()
  try {
    const key = `hors-ligne-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-06-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({
      data: { gameId: game.id, publicId: `h${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } }
    })
    const email = `iris-${key}@example.test`
    const participant = await prisma.participant.create({ data: { name: 'Iris Hors Ligne', slug: `iris-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
    await prisma.registration.create({
      data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email, links: { create: { tokenHash: `hash-${key}` } }, respondedAt: new Date(), dietary: 'Arachides', sessionLines: { create: { sessionId: session.id, status: 'preregistered', answer: 'available' } } }
    })
    await prisma.character.create({ data: { name: 'Seul PJ', slug: `pj-${key}`, gameId: game.id, type: 'pj' } })

    // Avec le réseau : la page, puis le détail de l'inscription, gardés sur l'appareil
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    const panel = gamePanel(page, game.title, 'Sélection')
    await expect(panel.getByText('Sessions · 1 personne dans le vivier')).toBeVisible()
    await panel.getByRole('button', { name: 'Détail' }).first().click()
    await expect(page.getByRole('dialog').getByText('Arachides')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    // Une décision relit le bloc du jeu : l'appareil garde ce nouvel état
    await panel.getByRole('button', { name: 'Retenir' }).click()
    await expect(panel.getByText('À annoncer')).toBeVisible()

    // Sans réseau : la page se rouvre depuis l'appareil, sélection et détail compris
    await context.setOffline(true)
    await page.getByRole('link', { name: 'Sessions' }).first().click()
    await page.waitForURL('**/sessions')
    await page.goBack()
    await expect(panel.getByText('Sessions · 1 personne dans le vivier')).toBeVisible()
    await expect(panel.getByText('Iris Hors Ligne').first()).toBeVisible()
    await expect(panel.getByText('À annoncer')).toBeVisible()
    await panel.getByRole('button', { name: 'Détail' }).first().click()
    await expect(page.getByRole('dialog').getByText('Arachides')).toBeVisible()
  } finally {
    await context.setOffline(false)
    await prisma.$disconnect()
  }
})
