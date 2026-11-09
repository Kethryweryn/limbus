// US-199 : trombinoscopes, fiches et documents d'une session (SPEC-005 R2 à R9 ; SPEC-006 R4, R6 à R8, R10, R12, R13)
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { openMailbox } from './mailbox'
import { E2E_USERS } from './constants'
import { castSession as castOf, gameCharacter as character, gamePerson, orgaGame, signIn, slugOf, test, uniqueName } from './helpers'

async function openDocumentsTab(page: Page, session: { slug: string, name: string }) {
  await page.goto(`/sessions/${session.slug}?tab=documents`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1, name: session.name })).toBeVisible()
}

test('trombinoscope : les réglages d’un personnage et l’étiquette d’un groupe s’appliquent, et générer de nouveau remplace (R2 à R5b, R9)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du trombinoscope')
    const viewer = await character(prisma, game.id, 'Aube regarde')
    const renamed = await character(prisma, game.id, 'Brume renommée')
    const left = await character(prisma, game.id, 'Ciel écarté')
    const excluded = await character(prisma, game.id, 'Garde exclue', { type: 'pnj', excludeFromTrombinoscope: true })
    const clan = uniqueName('Clan du nord')
    await prisma.faction.create({ data: { name: clan, slug: slugOf(clan), gameId: game.id, showInTrombinoscope: true, characterLinks: { create: { characterId: renamed.id } } } })
    const lea = await gamePerson(prisma, game.id, 'Léa trombi')
    const noe = await gamePerson(prisma, game.id, 'Noé trombi')
    const session = await castOf(prisma, game.id, 'Session des documents', [[viewer, lea], [renamed, noe]])
    await signIn(page, prisma, E2E_USERS.orga)

    // Réglages du trombinoscope d'Aube, depuis sa fiche (R3) : un nom affiché, un personnage écarté ; l'exclu global ne
    // se règle pas (R5)
    await page.goto(`/characters/${viewer.slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Trombinoscope' }).click()
    const modal = page.getByRole('dialog')
    const entry = (name: string) => modal.locator('article').filter({ has: page.getByRole('heading', { level: 3, name }) })
    await expect(entry(viewer.name)).toHaveCount(0)
    await expect(entry(excluded.name).getByLabel('Inclure')).toBeDisabled()
    await entry(renamed.name).getByLabel('Nom affiché').fill('Le Voyageur')
    await entry(left.name).getByLabel('Inclure').uncheck()
    await modal.getByRole('button', { name: 'Enregistrer' }).click()
    await expect.poll(() => prisma.characterTrombinoscopeEntry.count({ where: { viewerCharacterId: viewer.id } })).toBeGreaterThan(0)
    await page.keyboard.press('Escape')

    // Génération : un trombinoscope par personne castée (R7) ; celui d'Aube suit ses réglages, sans elle (R5b), avec
    // l'étiquette du groupe (R2)
    await openDocumentsTab(page, session)
    await page.getByRole('button', { name: 'Générer les trombinoscopes' }).click()
    await expect(page.getByText('Trombi généré')).toHaveCount(2)
    const cards = async (characterId: string) => (await prisma.sessionTrombinoscope.findFirstOrThrow({ where: { sessionId: session.id, viewerCharacterId: characterId }, select: { contentJson: true } })).contentJson as Array<{ displayName: string, tags: string[] }>
    expect(await cards(viewer.id)).toEqual([expect.objectContaining({ displayName: 'Le Voyageur', tags: expect.arrayContaining([clan]) })])

    // Brume perd sa joueuse : générer de nouveau retire son trombinoscope (R9)
    await prisma.sessionAssignment.updateMany({ where: { sessionId: session.id, characterId: renamed.id }, data: { participantId: null } })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Générer les trombinoscopes' }).click()
    await expect(page.getByText('Trombi généré')).toHaveCount(1)
    await expect.poll(() => prisma.sessionTrombinoscope.count({ where: { sessionId: session.id } })).toBe(1)
  } finally {
    await prisma.$disconnect()
  }
})

test('document : un brouillon ne s’envoie pas mais se teste, à 10 adresses au plus (R6, R8)', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const game = await orgaGame(prisma, 'Jeu du brouillon')
    const role = await character(prisma, game.id, 'Aube du brouillon')
    const lea = await gamePerson(prisma, game.id, 'Léa brouillon', '')
    const session = await castOf(prisma, game.id, 'Session des documents', [[role, lea]])
    const title = uniqueName('Lettre en brouillon')
    await prisma.document.create({ data: { title, slug: slugOf(title), content: 'Pas encore prête.', gameId: game.id, audiences: ['pjs'] } })
    const tester = `test-${slugOf(title)}@example.test`
    await signIn(page, prisma, E2E_USERS.orga)
    await openDocumentsTab(page, session)

    const card = page.locator('article').filter({ hasText: title })
    await expect(card.getByText('Brouillon', { exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Envoyer aux manquants' })).toBeDisabled()

    // Test : plus de 10 adresses refusées, puis une seule reçoit l'email « [Test] » ; la vraie destinataire, rien
    await card.getByRole('button', { name: 'Tester l\'email' }).click()
    const modal = page.getByRole('dialog')
    await modal.getByPlaceholder('adresse@example.com').fill(Array.from({ length: 11 }, (_, index) => `trop-${index}-${tester}`).join('\n'))
    await modal.getByRole('button', { name: 'Envoyer le test' }).click()
    // Le refus est dit en français (US-210)
    await expect(modal.getByText('Dix adresses au plus')).toBeVisible()
    expect(mailbox.to(`trop-0-${tester}`)).toHaveLength(0)

    await modal.getByPlaceholder('adresse@example.com').fill(tester)
    await modal.getByRole('button', { name: 'Envoyer le test' }).click()
    await expect.poll(() => mailbox.to(tester).length).toBe(1)
    expect(mailbox.to(tester)[0]!.raw).toContain('[Test]')
    expect(mailbox.to(lea.email!)).toHaveLength(0)
  } finally {
    await prisma.$disconnect()
  }
})

test('document : l’envoi part aux seuls manquants, liste un échec, et ignore une personne sans email (R4, R7, R12, R13)', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const game = await orgaGame(prisma, 'Jeu des envois')
    const [aube, brume, ciel] = await Promise.all(['Aube envoi', 'Brume envoi', 'Ciel envoi'].map((base) => character(prisma, game.id, base)))
    const lea = await gamePerson(prisma, game.id, 'Léa envoi', '')
    const noe = await gamePerson(prisma, game.id, 'Noé envoi', 'refuse-')
    const sam = await gamePerson(prisma, game.id, 'Sam sans email')
    const session = await castOf(prisma, game.id, 'Session des documents', [[aube!, lea], [brume!, noe], [ciel!, sam]])
    const title = uniqueName('Feuille de route envoyée')
    await prisma.document.create({ data: { title, slug: slugOf(title), content: 'Rendez-vous à 9 h.', gameId: game.id, audiences: ['pjs'], readyToSend: true } })
    await signIn(page, prisma, E2E_USERS.orga)
    await openDocumentsTab(page, session)

    // Destinataires selon le public : les trois personnes qui tiennent un PJ (R7)
    const card = page.locator('article').filter({ hasText: title })
    await expect(card.getByText(lea.name)).toBeVisible()
    await expect(card.getByText(noe.name)).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: 'Envoyer aux manquants' }).click()

    // Léa reçoit ; l'échec de Noé est listé sans arrêter l'envoi (R13) ; Sam, sans email, est ignorée sans erreur (R4)
    await expect(page.getByText(new RegExp(`Non envoyés : ${noe.name}`))).toBeVisible()
    await expect.poll(() => mailbox.to(lea.email!).length).toBe(1)
    await expect(page.getByText(new RegExp(`Non envoyés : .*${sam.name}`))).toHaveCount(0)

    // Adresse corrigée : le nouvel envoi ne part qu'à Noé (R12)
    const fixed = noe.email!.replace(/^refuse-/, 'corrige-')
    await prisma.participant.update({ where: { id: noe.id }, data: { email: fixed } })
    await page.reload()
    await page.waitForLoadState('networkidle')
    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: 'Envoyer aux manquants' }).click()
    await expect.poll(() => mailbox.to(fixed).length).toBe(1)
    expect(mailbox.to(lea.email!)).toHaveLength(1)
  } finally {
    await prisma.$disconnect()
  }
})

test('fiches personnage : seules les fiches prêtes partent, en PDF (R10)', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const game = await orgaGame(prisma, 'Jeu des fiches')
    const ready = await character(prisma, game.id, 'Aube prête', { sheetReadyToSend: true })
    const draft = await character(prisma, game.id, 'Brume en brouillon')
    const lea = await gamePerson(prisma, game.id, 'Léa fiche', '')
    const noe = await gamePerson(prisma, game.id, 'Noé fiche', '')
    const session = await castOf(prisma, game.id, 'Session des documents', [[ready, lea], [draft, noe]])
    await signIn(page, prisma, E2E_USERS.orga)
    await openDocumentsTab(page, session)

    await expect(page.getByText('Fiche prête')).toHaveCount(1)
    await expect(page.getByText('Fiche brouillon')).toHaveCount(1)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Envoyer fiches seules' }).click()
    await expect.poll(() => mailbox.to(lea.email!).length).toBe(1)
    expect(mailbox.to(lea.email!)[0]!.raw).toContain('application/pdf')
    expect(mailbox.to(noe.email!)).toHaveLength(0)
    await expect(page.getByText('Fiche envoyée')).toHaveCount(1)
  } finally {
    await prisma.$disconnect()
  }
})

test('PDF : la fiche d’un personnage, un document et la fiche allergies s’ouvrent depuis l’onglet (R11, R12)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu des PDF')
    const role = await character(prisma, game.id, 'Aube en PDF')
    const lea = await gamePerson(prisma, game.id, 'Léa PDF')
    const session = await castOf(prisma, game.id, 'Session des documents', [[role, lea]])
    const title = uniqueName('Document en PDF')
    const document = await prisma.document.create({ data: { title, slug: slugOf(title), content: 'Contenu du PDF.', gameId: game.id, audiences: ['pjs'] } })
    await signIn(page, prisma, E2E_USERS.orga)
    await openDocumentsTab(page, session)

    // « Vérifier la fiche » et « Vérifier le PDF » chargent chacun un PDF
    for (const [button, path] of [['Vérifier la fiche', `/documents/character-sheets/${role.id}/pdf`], ['Vérifier le PDF', `/documents/${document.id}/pdf`]] as const) {
      const loaded = page.waitForResponse((response) => response.url().includes(`/api/sessions/${session.id}${path}`))
      const popup = page.waitForEvent('popup')
      await page.getByRole('button', { name: button }).first().click()
      await popup
      const response = await loaded
      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain('application/pdf')
    }

    // Fiche allergies : personne n'en a déclaré, et son PDF s'ouvre quand même
    await expect(page.getByText('Aucune allergie ni intolérance déclarée.')).toBeVisible()
    const allergies = await page.request.get(`/api/sessions/${session.id}/allergies/pdf`)
    expect(allergies.status()).toBe(200)
    expect((await allergies.body()).subarray(0, 4).toString()).toBe('%PDF')
  } finally {
    await prisma.$disconnect()
  }
})
