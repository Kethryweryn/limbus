// SPEC-019, EPIC-052 : télécharger un jeu pour le consulter sans réseau (US-226), sur les quatre axes (ADR-0079) :
// actions, erreurs de saisie, droits, hors ligne
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { cardByTitle, castSession, gameCharacter, gamePerson, signIn, slugOf, test, testUser, uniqueName, type TestPrisma } from './helpers'

// Jeu propre au test, à une organisatrice qui n'a que lui : ses listes tiennent sur une page
async function ownGame(prisma: TestPrisma, base: string) {
  const owner = await testUser(prisma, `Orga ${base}`)
  const title = uniqueName(base)
  const game = await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.user.id, published: true } })
  const character = await gameCharacter(prisma, game.id, 'Aube Téléchargée', { type: 'pj' })
  const person = await gamePerson(prisma, game.id, 'Léa Téléchargée')
  const session = await castSession(prisma, game.id, 'Session téléchargée', [[character, person]])
  return { owner, game, character, person, session }
}

const card = (page: Page) => page.getByRole('region', { name: 'Hors ligne sur cet appareil' })
const gameRow = (page: Page, title: string) => card(page).getByRole('listitem', { name: title })

// Date des téléchargements gardés, reculée de quelques heures
async function setDownloadDates(page: Page, hoursAgo: Record<string, number>) {
  await page.evaluate((ages) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('limbus-db')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('offlineDownloads', 'readwrite')
      const store = tx.objectStore('offlineDownloads')
      for (const [gameId, hours] of Object.entries(ages)) {
        const get = store.get(gameId)
        get.onsuccess = () => store.put({ ...get.result, date: new Date(Date.now() - hours * 3600 * 1000).toISOString() }, gameId)
      }
      tx.oncomplete = () => { db.close(); resolve() }
    }
  }), hoursAgo)
}

// Nom gardé sur l'appareil pour la fiche d'un personnage, null si l'appareil ne l'a pas
async function storedName(page: Page, slug: string) {
  return await page.evaluate((url) => new Promise<string | null>((resolve) => {
    const request = indexedDB.open('limbus-db')
    request.onsuccess = () => {
      const db = request.result
      const get = db.transaction('responses').objectStore('responses').get(url)
      get.onsuccess = () => { db.close(); resolve(get.result?.name ?? null) }
    }
  }), `/api/characters/slug/${slug}`)
}

async function openAccount(page: Page) {
  await page.goto('/compte')
  await page.waitForLoadState('networkidle')
  await expect(card(page)).toBeVisible()
}

async function download(page: Page, title: string) {
  await gameRow(page, title).getByRole('button', { name: /^Télécharger/ }).click()
  await expect(card(page).getByText(`« ${title} » est téléchargé : il s’ouvre sans réseau sur cet appareil.`)).toBeVisible({ timeout: 30000 })
  await expect(gameRow(page, title).getByText(/^Téléchargé le /)).toBeVisible()
}

// Navigation dans Limbus, sans recharger : sans réseau, la page arrivée se lit sur l'appareil
async function openFromMenu(page: Page, link: string, title: string, open: 'card' | 'link' = 'card') {
  await page.getByRole('link', { name: link, exact: true }).first().click()
  // La carte d'un participant a son nom en lien, les autres en titre
  await (open === 'link' ? page.getByRole('main').getByRole('link', { name: title, exact: true }) : cardByTitle(page, title)).click()
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
}

test.describe('télécharger un jeu', () => {
  test('le jeu téléchargé s’ouvre sans réseau : fiches, contact d’urgence, session et ses PDF', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const { owner, game, character, person, session } = await ownGame(prisma, 'Jeu téléchargé')
      await signIn(page, prisma, owner.email)
      await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBeGreaterThan(0)
      await openAccount(page)
      await expect(card(page).getByText(/garde aussi le contact d’urgence et les allergies des participants/)).toBeVisible()
      await expect(gameRow(page, game.title).getByText('Pas encore téléchargé')).toBeVisible()
      await download(page, game.title)

      await context.setOffline(true)
      await openFromMenu(page, 'Personnages', character.name)
      await openFromMenu(page, 'Participants', person.name, 'link')
      // Contact d'urgence et allergies lus sur l'appareil, et non « Lecture impossible » (ADR-0080)
      await expect(page.getByText('Contact d’urgence : nom')).toBeVisible()
      await expect(page.getByText(/Lecture impossible pour l’instant/)).toBeHidden()
      await openFromMenu(page, 'Sessions', session.name)
      // PDF d'une session à venir, servi depuis l'appareil
      const pdf = await page.evaluate(async (id) => (await fetch(`/api/sessions/${id}/allergies/pdf`)).status, session.id)
      expect(pdf).toBe(200)
      await context.setOffline(false)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('sans réseau, le bouton est indisponible ; un réseau qui tombe arrête le téléchargement et le dit', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const { owner, game } = await ownGame(prisma, 'Jeu interrompu')
      await signIn(page, prisma, owner.email)
      await openAccount(page)

      await context.setOffline(true)
      await expect(card(page).getByText('Pas de réseau : le téléchargement demande une connexion.')).toBeVisible()
      await expect(gameRow(page, game.title).getByRole('button', { name: 'Télécharger' })).toBeDisabled()
      await context.setOffline(false)
      await expect(gameRow(page, game.title).getByRole('button', { name: 'Télécharger' })).toBeEnabled()

      // Le réseau tombe au milieu : les sessions ne répondent plus
      await page.route('**/api/sessions/slug/**', (route) => route.abort('internetdisconnected'))
      await gameRow(page, game.title).getByRole('button', { name: 'Télécharger' }).click()
      await expect(card(page).getByText(/Le réseau est tombé pendant le téléchargement/)).toBeVisible({ timeout: 30000 })
      await expect(gameRow(page, game.title).getByText('Pas encore téléchargé')).toBeVisible()
      await page.unroute('**/api/sessions/slug/**')
      await download(page, game.title)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une modification en attente garde sa copie pendant le téléchargement', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { owner, game, character } = await ownGame(prisma, 'Jeu en attente')
      await signIn(page, prisma, owner.email)
      await openAccount(page)
      const key = `/api/characters/slug/${character.slug}`
      // Déjà téléchargé une fois : le second téléchargement ne doit ni remplacer ni effacer la copie en attente
      await download(page, game.title)
      // Copie laissée par une modification faite sans réseau, pas encore envoyée (SPEC-010, R6)
      await page.evaluate((url) => new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('limbus-db')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('responses', 'readwrite')
          tx.objectStore('responses').put({ name: 'Copie en attente', __offlinePending: true }, url)
          tx.oncomplete = () => { db.close(); resolve() }
        }
      }), key)
      await download(page, game.title)
      const kept = await page.evaluate((url) => new Promise<unknown>((resolve) => {
        const request = indexedDB.open('limbus-db')
        request.onsuccess = () => {
          const db = request.result
          const get = db.transaction('responses').objectStore('responses').get(url)
          get.onsuccess = () => { db.close(); resolve(get.result) }
        }
      }), key)
      expect(kept).toEqual({ name: 'Copie en attente', __offlinePending: true })
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une co-organisatrice télécharge le jeu partagé ; une organisatrice sans accès et un jeu archivé n’ont pas de bouton', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { game } = await ownGame(prisma, 'Jeu partagé téléchargé')
      const archived = await ownGame(prisma, 'Jeu archivé téléchargé')
      const coorga = await testUser(prisma, 'Co-orga téléchargement')
      await prisma.gameShare.createMany({ data: [{ gameId: game.id, userId: coorga.user.id }, { gameId: archived.game.id, userId: coorga.user.id }] })
      await prisma.game.update({ where: { id: archived.game.id }, data: { published: false } })
      await signIn(page, prisma, coorga.email)
      await openAccount(page)
      await expect(gameRow(page, archived.game.title)).toHaveCount(0)
      await download(page, game.title)

      const stranger = await testUser(prisma, 'Sans accès téléchargement')
      await signIn(page, prisma, stranger.email)
      await openAccount(page)
      await expect(card(page).getByRole('heading', { name: 'Télécharger pour le hors ligne' })).toHaveCount(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('un accès retiré efface le jeu de l’appareil, contact d’urgence compris, et garde les autres jeux', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const lost = await ownGame(prisma, 'Jeu retiré')
      const kept = await ownGame(prisma, 'Jeu gardé')
      const coorga = await testUser(prisma, 'Co-orga retirée')
      await prisma.gameShare.createMany({ data: [{ gameId: lost.game.id, userId: coorga.user.id }, { gameId: kept.game.id, userId: coorga.user.id }] })
      await signIn(page, prisma, coorga.email)
      await openAccount(page)
      await download(page, lost.game.title)
      await download(page, kept.game.title)

      await prisma.gameShare.deleteMany({ where: { gameId: lost.game.id, userId: coorga.user.id } })
      await gameRow(page, lost.game.title).getByRole('button', { name: 'Télécharger de nouveau' }).click()
      await expect(card(page).getByText(`« ${lost.game.title} » n’est plus accessible : ce que l’appareil en gardait est effacé.`)).toBeVisible({ timeout: 30000 })
      await expect(gameRow(page, lost.game.title).getByText('Ce jeu n’est plus accessible : ce que l’appareil en gardait est effacé.')).toBeVisible()
      await expect(gameRow(page, lost.game.title).getByRole('button')).toHaveCount(0)

      const stored = await page.evaluate(() => new Promise<{ keys: string[], characters: Array<{ gameId: string }> }>((resolve) => {
        const request = indexedDB.open('limbus-db')
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(['responses', 'characters'])
          const keys = tx.objectStore('responses').getAllKeys()
          const characters = tx.objectStore('characters').get('list')
          tx.oncomplete = () => { db.close(); resolve({ keys: keys.result.map(String), characters: characters.result ?? [] }) }
        }
      }))
      expect(stored.keys).not.toContain(`/api/participants/${lost.person.id}/emergency`)
      expect(stored.keys).not.toContain(`/api/characters/slug/${lost.character.slug}`)
      expect(stored.keys).toContain(`/api/participants/${kept.person.id}/emergency`)
      expect(stored.characters.map((character) => character.gameId)).not.toContain(lost.game.id)
      expect(stored.characters.map((character) => character.gameId)).toContain(kept.game.id)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('un jeu téléchargé il y a plus d’une heure se remet à jour au retour du réseau ; un accès retiré l’efface (US-227, US-228)', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const fresh = await ownGame(prisma, 'Jeu récent')
      const old = await ownGame(prisma, 'Jeu ancien')
      const lost = await ownGame(prisma, 'Jeu perdu en route')
      const coorga = await testUser(prisma, 'Co-orga mise à jour')
      await prisma.gameShare.createMany({ data: [fresh, old, lost].map(({ game }) => ({ gameId: game.id, userId: coorga.user.id })) })
      await signIn(page, prisma, coorga.email)
      await openAccount(page)
      for (const { game } of [fresh, old, lost]) await download(page, game.title)

      // Le jeu récent a moins d'une heure ; les deux autres ont été téléchargés il y a deux heures
      await setDownloadDates(page, { [old.game.id]: 2, [lost.game.id]: 2, [fresh.game.id]: 0.2 })
      await prisma.character.update({ where: { id: old.character.id }, data: { name: `${old.character.name} renommé` } })
      await prisma.character.update({ where: { id: fresh.character.id }, data: { name: `${fresh.character.name} renommé` } })
      await prisma.gameShare.deleteMany({ where: { gameId: lost.game.id, userId: coorga.user.id } })

      // Retour du réseau : la mise à jour part en arrière-plan, et la section se relit à la fin
      const finished = page.evaluate(() => new Promise<void>((resolve) => window.addEventListener('limbus:offline-downloads', () => resolve(), { once: true })))
      await page.evaluate(() => window.dispatchEvent(new Event('online')))
      await finished

      expect(await storedName(page, old.character.slug)).toBe(`${old.character.name} renommé`)
      expect(await storedName(page, fresh.character.slug)).toBe(fresh.character.name)
      await expect(gameRow(page, lost.game.title).getByText('Ce jeu n’est plus accessible : ce que l’appareil en gardait est effacé.')).toBeVisible()
      expect(await storedName(page, lost.character.slug)).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('désactivé sur l’appareil, le téléchargement est indisponible et le dit', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { owner, game } = await ownGame(prisma, 'Jeu désactivé')
      await signIn(page, prisma, owner.email)
      await openAccount(page)
      await card(page).getByRole('checkbox', { name: 'Garder Limbus sur cet appareil pour le hors ligne' }).click()
      await card(page).getByRole('button', { name: 'Désactiver', exact: true }).click()
      await expect(card(page).getByText('Le hors ligne est désactivé sur cet appareil.')).toBeVisible()
      await expect(card(page).getByText('Le hors ligne est désactivé sur cet appareil : rien ne peut y être téléchargé.')).toBeVisible()
      await expect(gameRow(page, game.title).getByRole('button', { name: 'Télécharger' })).toBeDisabled()
    } finally {
      await prisma.$disconnect()
    }
  })
})
