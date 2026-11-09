// US-212 : toute fiche consultée avec le réseau se rouvre sans réseau (SPEC-010 R1), sauf le contact d'urgence et les
// allergies d'une personne, jamais gardés sur l'appareil (SPEC-007 R1b)
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { gamePerson, orgaGame, signIn, slugOf, test, uniqueName } from './helpers'

// Navigation dans l'application, comme un lien : sans réseau, une page ne se recharge pas entière
async function navigate(page: Page, path: string) {
  await page.evaluate((target) => (document.querySelector('#__nuxt') as unknown as { __vue_app__: { config: { globalProperties: { $router: { push: (to: string) => Promise<unknown> } } } } })
    .__vue_app__.config.globalProperties.$router.push(target), path)
}

async function online(page: Page, path: string, title: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

test('chaque fiche consultée avec le réseau se rouvre sans réseau, et une fiche jamais consultée le dit', async ({ page, context }) => {
  test.setTimeout(120_000)
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu des fiches hors ligne')
    const named = (base: string) => uniqueName(base)
    const faction = await prisma.faction.create({ data: { name: named('Groupe hors ligne'), slug: slugOf(named('groupe-hl')), gameId: game.id } })
    const intrigue = await prisma.intrigue.create({ data: { name: named('Intrigue hors ligne'), slug: slugOf(named('intrigue-hl')), gameId: game.id } })
    const item = await prisma.item.create({ data: { name: named('Objet hors ligne'), slug: slugOf(named('objet-hl')), gameId: game.id } })
    const location = await prisma.location.create({ data: { name: named('Lieu hors ligne'), slug: slugOf(named('lieu-hl')), gameId: game.id } })
    const document = await prisma.document.create({ data: { title: named('Document hors ligne'), slug: slugOf(named('document-hl')), content: 'Texte', gameId: game.id } })
    const event = await prisma.timelineEvent.create({ data: { name: named('Événement hors ligne'), slug: slugOf(named('evenement-hl')), gameId: game.id, day: 1, time: '10:00' } })
    const person = await gamePerson(prisma, game.id, 'Personne hors ligne')
    const never = await orgaGame(prisma, 'Jeu jamais consulté')
    const sheets: Array<[string, string]> = [
      [`/games/${game.slug}`, game.title],
      [`/factions/${faction.slug}`, faction.name],
      [`/intrigues/${intrigue.slug}`, intrigue.name],
      [`/items/${item.slug}`, item.name],
      [`/locations/${location.slug}`, location.name],
      [`/documents/${document.slug}`, document.title],
      [`/timeline/${event.slug}`, event.name],
      [`/participants/${person.slug}`, person.name]
    ]
    await signIn(page, prisma, E2E_USERS.orga)
    for (const [path, title] of sheets) await online(page, path, title)

    // Sans réseau : chaque fiche se rouvre en naviguant dans l'application
    await context.setOffline(true)
    for (const [path, title] of sheets) {
      await navigate(page, path)
      await expect(page.getByRole('heading', { level: 1, name: title }), path).toBeVisible()
    }

    // Le contact d'urgence et les allergies ne sont pas sur l'appareil, et la fiche le dit
    await navigate(page, `/participants/${person.slug}`)
    await expect(page.getByText(/ne sont pas gardés sur l’appareil/)).toBeVisible()

    // Une fiche jamais consultée avec le réseau le dit, au lieu d'une erreur générale
    await navigate(page, `/games/${never.slug}`)
    await expect(page.getByText(/pas été consultée avec le réseau sur cet appareil/)).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
