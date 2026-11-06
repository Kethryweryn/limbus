import { expect, test, type Locator } from '@playwright/test'
import { DEFAULT_REGISTRATION_FORM_DEFINITION } from '../../utils/registrationForms'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { gamePanel, signIn } from './helpers'

// EPIC-037 (US-133) : l'encadré « Qualité du questionnaire » signale un personnage sans lien, puis plus rien une fois relié.
// EPIC-039 (US-136, US-139) : une fois la question reliée, les réponses reçues donnent leurs repères
// EPIC-040 (US-140) : et l'estimation générale
test('l’encadré de qualité signale un personnage sans lien, puis les repères sur les réponses après l’ajout du lien', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `qualite-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = `Jeu ${key}`
    const game = await prisma.game.create({ data: { title, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    await prisma.character.create({ data: { name: 'Aldric Qualité', slug: `aldric-${key}`, gameId: game.id } })
    await prisma.registrationForm.create({
      data: {
        gameId: game.id,
        versions: { create: { number: 1, definition: { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: [{ id: 'style', label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] }] } } }
      }
    })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: key } })
    for (const name of ['zoe', 'ines', 'leo', 'hugo']) {
      const email = `${name}-${key}@example.test`
      const person = await prisma.participant.create({ data: { name: `${name} ${key}`, slug: `${name}-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
      await prisma.registration.create({ data: { periodId: period.id, participantId: person.id, status: 'received', source: 'form', email, questionAnswers: { style: 'Intrigue' } } })
    }

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    await gamePanel(page, title, 'Formulaire').getByRole('button', { name: 'Formulaire' }).click()
    const dialog = page.getByRole('dialog')
    const missing = dialog.getByText('Aldric Qualité n’est relié à aucune réponse : l’assistant ne pourra lui proposer personne.')
    await expect(missing).toBeVisible()
    // Aucune question n'est reliée : les réponses reçues ne comptent pas encore
    await expect(dialog.getByText('Estimation générale')).toBeHidden()
    await expect(dialog.getByText('« Ton style » n’est reliée à aucun rôle : ses réponses ne comptent pas dans le casting.')).toBeVisible()

    // Relier l'option Intrigue au personnage
    await dialog.getByText('Personnages, factions, intrigues…').first().click()
    await page.getByRole('option', { name: 'Aldric Qualité' }).click()
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.getByText('Aucun changement : la version en vigueur est conservée.')).toBeVisible()

    await expect(missing).toBeHidden()
    await expect(dialog.getByText('L’option « Combat » de « Ton style » n’est reliée à aucun rôle.')).toBeVisible()

    await expect(dialog.getByText('Estimation générale')).toBeVisible()
    await expect(dialog.getByText('Une fois les rôles répartis au mieux, chaque personne qui reçoit un rôle obtient en moyenne 100 % de sa meilleure note possible.')).toBeVisible()
    await expect(dialog.getByText('0 personne sur 4 a plusieurs personnages à égalité en tête.')).toBeVisible()
    await expect(dialog.getByText('4 personnes sur 4 ont répondu « Intrigue » à « Ton style » : cette question ne départage presque personne.')).toBeVisible()
    await expect(dialog.getByText('Aldric Qualité arrive en tête pour 4 personnes sur 4 : ce personnage sera disputé.')).toBeVisible()
    await expect(dialog.getByText('Ces repères portent sur le formulaire et les liens enregistrés, et sur les réponses de 4 personnes.')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-038 (US-135) : l'essai porte sur les liens pas encore enregistrés, et ne laisse rien
test('l’essai du questionnaire classe les personnages selon les réponses, sans rien enregistrer', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `essai-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = `Jeu ${key}`
    const game = await prisma.game.create({ data: { title, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    await prisma.character.create({ data: { name: 'Aldric Essai', slug: `aldric-${key}`, gameId: game.id } })
    const loups = await prisma.faction.create({ data: { name: 'Loups', slug: `loups-${key}`, gameId: game.id } })
    await prisma.character.create({ data: { name: 'Bertrand Essai', slug: `bertrand-${key}`, gameId: game.id, factions: { connect: { id: loups.id } } } })
    await prisma.registrationForm.create({
      data: {
        gameId: game.id,
        versions: { create: { number: 1, definition: { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: [{ id: 'style', label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] }] } } }
      }
    })
    await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: key } })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    await gamePanel(page, title, 'Formulaire').getByRole('button', { name: 'Formulaire' }).click()
    const editor = page.getByRole('dialog', { name: /Formulaire d’inscription/ })
    const tryButton = editor.getByRole('button', { name: 'Essayer le questionnaire' })
    await expect(tryButton).toBeEnabled()

    // Sans lien, la fenêtre le dit
    await tryButton.click()
    const trial = page.getByRole('dialog', { name: 'Essayer le questionnaire' })
    await expect(trial.getByText('Aucune question n’est reliée à un rôle')).toBeVisible()
    await trial.getByRole('button', { name: 'Close' }).click()
    await expect(trial).toBeHidden()

    // Des liens pas encore enregistrés comptent dans l'essai, ceux d'une nouvelle question aussi
    const linkOption = async (target: string) => {
      await editor.getByText('Personnages, factions, intrigues…').first().click()
      await page.getByRole('option', { name: target }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('option')).toHaveCount(0)
    }
    await linkOption('Aldric Essai')
    await linkOption('Loups (faction)')
    await editor.getByRole('button', { name: 'Ajouter une question' }).click()
    await editor.getByLabel('Question', { exact: true }).last().fill('Ton envie')
    await editor.getByRole('combobox').last().click()
    await page.getByRole('option', { name: 'Choix unique' }).click()
    await editor.getByLabel('Options', { exact: true }).last().fill('Romance\nTrahison')
    await linkOption('Aldric Essai')
    await tryButton.click()
    await expect(trial.getByText('Aldric Essai, Bertrand Essai')).toBeVisible()

    await trial.getByRole('radio', { name: 'Intrigue' }).check()
    await expect(trial.getByRole('listitem').filter({ hasText: 'Aldric Essai' })).toContainText('1 point')
    await expect(trial.getByText('« Ton style » : Intrigue → Aldric Essai (+1)')).toBeVisible()
    await expect(trial.getByText('Qu’aucune réponse donnée ne rejoint')).toBeVisible()
    await expect(trial.getByText('Bertrand Essai')).toBeVisible()

    await trial.getByRole('radio', { name: 'Romance' }).check()
    await expect(trial.getByRole('listitem').filter({ hasText: 'Aldric Essai' })).toContainText('2 points')

    await trial.getByRole('radio', { name: 'Combat' }).check()
    await expect(trial.getByRole('listitem').filter({ hasText: 'Bertrand Essai' })).toContainText('0,5 point')
    await expect(trial.getByText('« Ton style » : Combat → faction Loups (+0,5)', { exact: true })).toBeVisible()

    // Fermer oublie les réponses et n'écrit rien
    await trial.getByRole('button', { name: 'Close' }).click()
    await expect(trial).toBeHidden()
    expect(await prisma.registration.count({ where: { period: { gameId: game.id } } })).toBe(0)
    expect(await prisma.registrationQuestionLink.count({ where: { gameId: game.id } })).toBe(0)
    await tryButton.click()
    await expect(trial.getByText('Aldric Essai, Bertrand Essai')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-042 (US-144) : la partie « Rédaction » groupe ses signalements par question, et se replie une fois des réponses reçues
// (US-146) : les options cochées se mélangent, dans l'aperçu et l'essai, et l'ordre tient pendant qu'on répond ; le formulaire enregistre le réglage
test('la relecture signale les questions, et le mélange des options tient pendant la réponse', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `redaction-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = `Jeu ${key}`
    const game = await prisma.game.create({ data: { title, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    await prisma.character.create({ data: { name: 'Aldric Rédaction', slug: `aldric-${key}`, gameId: game.id } })
    const options = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']
    await prisma.registrationForm.create({
      data: {
        gameId: game.id,
        versions: { create: { number: 1, definition: { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: [{ id: 'style', label: 'Joues-tu souvent ?', type: 'single', required: false, options }] } } }
      }
    })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: key } })
    const openEditor = async () => {
      await page.goto('/registrations')
      await page.waitForLoadState('networkidle')
      await gamePanel(page, title, 'Formulaire').getByRole('button', { name: 'Formulaire' }).click()
    }
    await signIn(page, prisma, E2E_USERS.orga)
    await openEditor()
    const editor = page.getByRole('dialog', { name: /Formulaire d’inscription/ })

    // Rédaction : dépliée avant les réponses, le défaut sous sa question
    const draftingTitle = editor.locator('summary').filter({ hasText: 'Rédaction' })
    await expect(draftingTitle).toContainText('À surveiller')
    await expect(draftingTitle).toContainText('1 signalement')
    const flag = editor.getByText('Quantifieur vague : « souvent » dans le libellé.')
    await expect(flag).toBeVisible()
    await expect(editor.getByText('Chacun le comprend à sa façon', { exact: false })).toBeVisible()

    // Mélange : coché, il crée une version, et l'aperçu tire un autre ordre
    const orderIn = (scope: Locator) => scope.getByRole('radio').evaluateAll((radios) => radios.map((radio) => (radio as HTMLButtonElement).labels?.[0]?.textContent?.trim() ?? ''))
    await editor.getByRole('checkbox', { name: 'Mélanger les options' }).check()
    await editor.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(editor.getByText('Version 2 enregistrée.')).toBeVisible()
    const version = await prisma.registrationFormVersion.findFirstOrThrow({ where: { form: { gameId: game.id } }, orderBy: { number: 'desc' } })
    expect((version.definition as { questions: Array<{ shuffleOptions?: boolean }> }).questions[0]!.shuffleOptions).toBe(true)
    const previewOrder = await orderIn(editor)
    expect([...previewOrder].sort()).toEqual(options)
    expect(previewOrder).not.toEqual(options)

    // L'essai présente un ordre tiré au hasard, qui ne bouge pas quand on répond
    await editor.getByRole('button', { name: 'Essayer le questionnaire' }).click()
    const trial = page.getByRole('dialog', { name: 'Essayer le questionnaire' })
    await expect(trial.getByRole('radio', { name: 'Alpha' })).toBeVisible()
    const names = await orderIn(trial)
    expect([...names].sort()).toEqual(options)
    expect(names).not.toEqual(options)
    await trial.getByRole('radio', { name: names[3]! }).click()
    await expect(trial.getByRole('radio', { name: names[3]! })).toBeChecked()
    expect(await orderIn(trial)).toEqual(names)
    await page.keyboard.press('Escape')

    // Une fois des réponses reçues, même à une question sans lien, la partie reste là, repliée, avec son niveau
    const email = `zoe-${key}@example.test`
    const person = await prisma.participant.create({ data: { name: `Zoé ${key}`, slug: `zoe-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
    await prisma.registration.create({ data: { periodId: period.id, participantId: person.id, status: 'received', source: 'form', email, questionAnswers: { style: 'Alpha' } } })
    await openEditor()
    await expect(draftingTitle).toContainText('À surveiller')
    await expect(flag).toBeHidden()
    await draftingTitle.click()
    await expect(flag).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

// Le calcul de la prévision échoue : le message le dit (limite connue d'EPIC-041, US-143)
test('l’échec du calcul de la prévision s’affiche', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `echec-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = `Jeu ${key}`
    const game = await prisma.game.create({ data: { title, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const aldric = await prisma.character.create({ data: { name: 'Aldric Échec', slug: `aldric-${key}`, gameId: game.id } })
    await prisma.registrationForm.create({
      data: {
        gameId: game.id,
        versions: { create: { number: 1, definition: { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: [{ id: 'style', label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] }] } } }
      }
    })
    await prisma.registrationQuestionLink.create({ data: { gameId: game.id, questionId: 'style', option: 'Intrigue', characterId: aldric.id } })
    // Un Web Worker qui plante : Chromium ne laisse pas intercepter la requête de son script
    await page.addInitScript(() => {
      class FailingWorker {
        onerror: ((event: Event) => void) | null = null
        postMessage() { setTimeout(() => this.onerror?.(new Event('error'))) }
        terminate() {}
      }
      Object.defineProperty(window, 'Worker', { value: FailingWorker })
    })
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    await gamePanel(page, title, 'Formulaire').getByRole('button', { name: 'Formulaire' }).click()
    await expect(page.getByRole('dialog', { name: /Formulaire d’inscription/ }).getByText('Impossible de calculer la prévision.')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-041 (US-141 à US-143) : la prévision tourne dans son Web Worker, suit les proportions enregistrées, et se replie une fois des réponses reçues
test('la prévision du questionnaire suit les proportions attendues', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `prevision-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = `Jeu ${key}`
    const game = await prisma.game.create({ data: { title, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const names = ['Aldric', 'Bertrand', 'Cyrielle', 'Dorian']
    const [aldric, bertrand] = await Promise.all(names.map((name) => prisma.character.create({ data: { name: `${name} Prévision`, slug: `${name.toLowerCase()}-${key}`, gameId: game.id } })))
    await prisma.registrationForm.create({
      data: {
        gameId: game.id,
        versions: { create: { number: 1, definition: { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: [{ id: 'style', label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] }] } } }
      }
    })
    await prisma.registrationQuestionLink.createMany({
      data: [
        { gameId: game.id, questionId: 'style', option: 'Intrigue', characterId: aldric!.id },
        { gameId: game.id, questionId: 'style', option: 'Combat', characterId: bertrand!.id }
      ]
    })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: key } })

    const openEditor = async () => {
      await page.goto('/registrations')
      await page.waitForLoadState('networkidle')
      await gamePanel(page, title, 'Formulaire').getByRole('button', { name: 'Formulaire' }).click()
    }
    await signIn(page, prisma, E2E_USERS.orga)
    await openEditor()
    const editor = page.getByRole('dialog', { name: /Formulaire d’inscription/ })

    // Avant les réponses, la partie est dépliée, et le calcul aboutit malgré la CSP
    await expect(editor.getByText('Vos questions distinguent au plus 2 profils de réponses, pour 4 personnages.')).toBeVisible()
    await expect(editor.getByText(/Pour une inscription typique, chaque personne qui reçoit un rôle/)).toBeVisible()
    await expect(editor.getByText(/Chaque réponse a la même chance/)).toBeVisible()
    await expect(editor.getByText('Impossible de calculer la prévision.')).toBeHidden()

    // Une proportion invalide est refusée avant d'enregistrer quoi que ce soit
    await editor.getByText('Proportions attendues (facultatif)').click()
    await editor.getByLabel('Part attendue : Intrigue').fill('0')
    await editor.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(editor.getByText('« Ton style » : au moins une part doit être positive, ou laissez-les toutes vides.')).toBeVisible()
    expect(await prisma.registrationOptionExpectation.count({ where: { gameId: game.id } })).toBe(0)

    // Tout le monde sur la même option : le personnage est disputé, l'autre peu demandé
    await editor.getByLabel('Part attendue : Intrigue').fill('100')
    await editor.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(editor.getByText('Aldric Prévision serait disputé dans 10 simulations sur 10.')).toBeVisible()
    await expect(editor.getByText('Bertrand Prévision serait peu demandé dans 10 simulations sur 10.')).toBeVisible()
    await expect(editor.getByText(/Les réponses suivent vos proportions/)).toBeVisible()
    expect(await prisma.registrationFormVersion.count({ where: { form: { gameId: game.id } } })).toBe(1)
    const savedRow = () => prisma.registrationOptionExpectation.findFirstOrThrow({ where: { gameId: game.id } })
    const firstVersion = (await savedRow()).updatedAt

    // Enregistrer sans changer les proportions ne les réécrit pas, et le volet reste déplié
    await expect(editor.getByLabel('Part attendue : Intrigue')).toBeVisible()
    await editor.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(editor.getByText('Aucun changement : la version en vigueur est conservée.')).toBeVisible()
    expect((await savedRow()).updatedAt).toEqual(firstVersion)

    // Une part suit son option renommée
    await editor.getByLabel('Options', { exact: true }).fill('Manigance\nCombat')
    await expect(editor.getByLabel('Part attendue : Manigance')).toHaveValue('100')
    await editor.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(editor.getByText('Version 2 enregistrée.')).toBeVisible()
    await expect.poll(async () => (await savedRow()).option).toBe('Manigance')

    // Les proportions se retrouvent à la réouverture
    await openEditor()
    await editor.getByText('Proportions attendues (facultatif)').click()
    await expect(editor.getByLabel('Part attendue : Manigance')).toHaveValue('100')
    await expect(editor.getByLabel('Part attendue : Combat')).toHaveValue('')

    // Une fois des réponses reçues, la partie reste là, repliée
    const email = `zoe-${key}@example.test`
    const person = await prisma.participant.create({ data: { name: `Zoé ${key}`, slug: `zoe-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
    await prisma.registration.create({ data: { periodId: period.id, participantId: person.id, status: 'received', source: 'form', email, questionAnswers: { style: 'Manigance' } } })
    await openEditor()
    const forecastTitle = editor.locator('summary').filter({ hasText: 'Prévision' })
    await expect(forecastTitle).toContainText('À revoir')
    const typical = editor.getByText(/Pour une inscription typique, chaque personne qui reçoit un rôle/)
    await expect(typical).toBeHidden()
    await forecastTitle.click()
    await expect(typical).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
