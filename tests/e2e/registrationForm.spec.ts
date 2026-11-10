// US-203 (EPIC-050, lot 6, 2/2) : le formulaire d'inscription et la qualité du questionnaire (SPEC-001 R8, R9,
// SPEC-015, SPEC-016), sur les quatre axes (ADR-0079) : actions, erreurs de saisie, droits, hors ligne
import { expect, type Page } from '@playwright/test'
import { DEFAULT_REGISTRATION_FORM_DEFINITION } from '../../utils/registrationForms'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { choose, gamePanel, openRegistrations, orgaGame, signIn, slugOf, test, testUser, uniqueName, type TestPrisma } from './helpers'

type Question = { id: string, label: string, type: 'text' | 'single' | 'multiple' | 'scale', required: boolean, options?: string[] }

// Jeu propre au test, avec ses personnages PJ, son formulaire (version 1) et son vivier
async function formGame(prisma: TestPrisma, base: string, characters: string[], questions: Question[]) {
  const game = await orgaGame(prisma, base)
  const roles: Record<string, string> = {}
  for (const character of characters) {
    const name = uniqueName(character)
    roles[character] = (await prisma.character.create({ data: { name, slug: slugOf(name), gameId: game.id, type: 'pj' } })).id
  }
  await prisma.registrationForm.create({ data: { gameId: game.id, versions: { create: { number: 1, definition: { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions } } } } })
  const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, state: 'open' } })
  return { game, roles, period }
}

// Réponses de personnes du vivier aux questions du jeu
async function answers(prisma: TestPrisma, ctx: Awaited<ReturnType<typeof formGame>>, rows: Array<Record<string, string>>) {
  for (const [index, questionAnswers] of rows.entries()) {
    const name = uniqueName(`Personne ${index + 1}`)
    const email = `${slugOf(name)}@example.test`
    const person = await prisma.participant.create({ data: { name, slug: slugOf(name), email, gameLinks: { create: { gameId: ctx.game.id } } } })
    await prisma.registration.create({ data: { gameId: ctx.game.id, periodId: ctx.period.id, participantId: person.id, status: 'received', source: 'form', email, questionAnswers } })
  }
}

async function openEditor(page: Page, game: { title: string }) {
  await openRegistrations(page, game.title)
  await gamePanel(page, game.title, 'Formulaire').getByRole('button', { name: 'Formulaire' }).click()
  const editor = page.getByRole('dialog', { name: /Formulaire d’inscription/ })
  await expect(editor.getByRole('button', { name: 'Enregistrer' })).toBeVisible()
  return editor
}

const versions = (prisma: TestPrisma, gameId: string) => prisma.registrationFormVersion.count({ where: { form: { gameId } } })

test.describe('éditeur du formulaire', () => {
  test('une question sans libellé, ou à choix avec une seule option, est refusée sans nouvelle version', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await formGame(prisma, 'Formulaire refusé', ['Aube'], [])
      await signIn(page, prisma, E2E_USERS.orga)
      const editor = await openEditor(page, ctx.game)

      await editor.getByRole('button', { name: 'Ajouter une question' }).click()
      await editor.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(editor.getByText(/Le libellé de la question est obligatoire/)).toBeVisible()

      await editor.getByLabel('Question', { exact: true }).last().fill('Ton arme')
      await choose(page, editor.getByRole('combobox', { name: 'Sorte' }).last(), 'Choix unique')
      await editor.getByRole('textbox', { name: 'Options' }).last().fill('Épée')
      await editor.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(editor.getByText(/Une question à choix demande au moins deux options/)).toBeVisible()
      expect(await versions(prisma, ctx.game.id)).toBe(1)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une co-organisatrice enregistre le formulaire ; une organisatrice sans accès ne le lit pas', async ({ page, otherPage }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await formGame(prisma, 'Formulaire partagé', ['Aube'], [])
      const { user, email } = await testUser(prisma, 'Co-orga formulaire')
      await prisma.gameShare.create({ data: { gameId: ctx.game.id, userId: user.id } })
      await signIn(page, prisma, email)
      const editor = await openEditor(page, ctx.game)
      await editor.getByRole('button', { name: 'Ajouter une question' }).click()
      await editor.getByLabel('Question', { exact: true }).last().fill('Ton style')
      await editor.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(editor.getByText('Version 2 enregistrée.')).toBeVisible()

      const stranger = await otherPage()
      const { email: strangerEmail } = await testUser(prisma, 'Orga sans formulaire')
      await signIn(stranger, prisma, strangerEmail)
      const refused = await stranger.request.get(`/api/games/${ctx.game.id}/registration-form`)
      expect([403, 404]).toContain(refused.status())
      expect(await versions(prisma, ctx.game.id)).toBe(2)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, le formulaire enregistré part au retour du réseau, et l’éditeur fermé ne se rouvre pas sans réseau', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await formGame(prisma, 'Formulaire hors ligne', ['Aube'], [])
      await signIn(page, prisma, E2E_USERS.orga)
      const editor = await openEditor(page, ctx.game)
      await context.setOffline(true)
      await editor.getByRole('button', { name: 'Ajouter une question' }).click()
      await editor.getByLabel('Question', { exact: true }).last().fill('Question hors ligne')
      await editor.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(editor.getByText(/Hors ligne : le formulaire sera enregistré au retour du réseau/)).toBeVisible()

      // Fermé puis rouvert sans réseau : l'éditeur dit qu'il lui faut une connexion
      await editor.getByRole('button', { name: 'Close' }).click()
      await gamePanel(page, ctx.game.title, 'Formulaire').getByRole('button', { name: 'Formulaire' }).click()
      await expect(page.getByRole('dialog', { name: /Formulaire d’inscription/ }).getByText(/Pas de réseau : cette page demande une connexion/)).toBeVisible()

      await context.setOffline(false)
      await page.reload()
      await expect.poll(() => versions(prisma, ctx.game.id), { timeout: 15000 }).toBe(2)
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('qualité du questionnaire', () => {
  test('deux personnages aux mêmes liens et deux questions en doublon sont signalés', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await formGame(prisma, 'Questionnaire doublon', ['Aube', 'Brune'], [
        { id: 'style', label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] },
        { id: 'goût', label: 'Ce que tu aimes', type: 'single', required: false, options: ['Parler', 'Se battre'] }
      ])
      // Les deux personnages reçoivent les mêmes points pour chaque réponse (R6)
      await prisma.registrationQuestionLink.createMany({
        data: [
          { gameId: ctx.game.id, questionId: 'style', option: 'Intrigue', characterId: ctx.roles.Aube! },
          { gameId: ctx.game.id, questionId: 'style', option: 'Intrigue', characterId: ctx.roles.Brune! },
          { gameId: ctx.game.id, questionId: 'goût', option: 'Parler', characterId: ctx.roles.Aube! },
          { gameId: ctx.game.id, questionId: 'goût', option: 'Parler', characterId: ctx.roles.Brune! }
        ]
      })
      // Mêmes réponses aux deux questions, chez 30 personnes (R10)
      await answers(prisma, ctx, Array.from({ length: 30 }, (_, index) => index % 2 ? { style: 'Intrigue', goût: 'Parler' } : { style: 'Combat', goût: 'Se battre' }))
      await signIn(page, prisma, E2E_USERS.orga)
      const editor = await openEditor(page, ctx.game)

      const aube = await prisma.character.findUniqueOrThrow({ where: { id: ctx.roles.Aube! } })
      const brune = await prisma.character.findUniqueOrThrow({ where: { id: ctx.roles.Brune! } })
      await expect(editor.getByText(`${aube.name} et ${brune.name} rapportent presque les mêmes points pour chaque réponse : le questionnaire aura du mal à les départager.`)).toBeVisible()
      await expect(editor.getByText(/« Ton style » et « Ce que tu aimes » font doublon/)).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une échelle tassée à une extrémité est signalée', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await formGame(prisma, 'Questionnaire échelle', ['Aube', 'Brune'], [
        { id: 'tension', label: 'Goût pour la tension', type: 'scale', required: false }
      ])
      await prisma.registrationQuestionLink.createMany({
        data: [
          { gameId: ctx.game.id, questionId: 'tension', option: '', characterId: ctx.roles.Aube! }
        ]
      })
      // 13 personnes sur 30 à la note 5 : plus que la part d'une note dans une répartition égale, sans écraser les autres réponses
      const notes = [...Array(13).fill('5'), ...Array(6).fill('4'), ...Array(6).fill('3'), ...Array(5).fill('2')]
      await answers(prisma, ctx, notes.map((tension) => ({ tension })))
      await signIn(page, prisma, E2E_USERS.orga)
      const editor = await openEditor(page, ctx.game)
      await expect(editor.getByText(/13 personnes sur 30 ont donné la note 5 à « Goût pour la tension » : l’échelle est tassée à cette extrémité\./)).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('la prévision donne le même résultat à chaque ouverture', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await formGame(prisma, 'Prévision stable', ['Aube', 'Brune', 'Cyan'], [
        { id: 'style', label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat', 'Ruse'] }
      ])
      await prisma.registrationQuestionLink.createMany({
        data: [
          { gameId: ctx.game.id, questionId: 'style', option: 'Intrigue', characterId: ctx.roles.Aube! },
          { gameId: ctx.game.id, questionId: 'style', option: 'Combat', characterId: ctx.roles.Brune! },
          { gameId: ctx.game.id, questionId: 'style', option: 'Ruse', characterId: ctx.roles.Cyan! }
        ]
      })
      await signIn(page, prisma, E2E_USERS.orga)
      let editor = await openEditor(page, ctx.game)
      const forecast = editor.getByText(/Pour une inscription typique, chaque personne qui reçoit un rôle/)
      await expect(forecast).toBeVisible()
      const first = await forecast.textContent()

      await editor.getByRole('button', { name: 'Close' }).click()
      editor = await openEditor(page, ctx.game)
      await expect(editor.getByText(/Pour une inscription typique, chaque personne qui reçoit un rôle/)).toHaveText(first!)
    } finally {
      await prisma.$disconnect()
    }
  })
})
