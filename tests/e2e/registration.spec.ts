import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { personalLinkToken, startTestSmtp } from '../integration/smtp'
import { E2E_USERS } from './constants'
import { expectLoggedIn, login } from './helpers'

// EPIC-001 : invitation par l'organisatrice → réponse par le lien personnel → présence dans la session
test('une personne invitée accepte par son lien et rejoint la session', async ({ page, browser }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    await login(page, E2E_USERS.orga)
    await expectLoggedIn(page)
    await page.goto('/registrations')
    await page.getByRole('button', { name: 'Inviter', exact: true }).click()
    await page.getByText('Camille Invitée').click()
    await page.getByRole('button', { name: 'Inviter (1)' }).click()
    await expect(page.getByText('1 invitation, 1 email envoyé.')).toBeVisible()

    await expect.poll(() => smtp.received.length).toBe(1)
    const token = personalLinkToken(smtp.received[0]!)
    expect(smtp.received[0]!.to).toEqual(['camille.invitee@example.test'])

    // La personne invitée n'a pas de compte : navigateur vierge
    const guest = await (await browser.newContext()).newPage()
    await guest.goto(`/inscription/${token}`)
    await guest.waitForLoadState('networkidle')
    await expect(guest.getByRole('heading', { name: 'Jeu des inscriptions' })).toBeVisible()
    await expect(guest.getByText('Jouer ensemble, avec bienveillance.')).toBeVisible()
    await expect(guest.getByLabel('Prénom')).toHaveValue('Camille')

    await guest.getByLabel('Nom', { exact: true }).fill('Invitée')
    await guest.getByLabel('Téléphone', { exact: true }).fill('0612345678')
    await guest.getByLabel('Contact d’urgence : nom').fill('Dominique')
    await guest.getByLabel('Contact d’urgence : téléphone').fill('0698765432')
    await guest.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await guest.getByRole('button', { name: 'Accepter l’invitation' }).click()
    await expect(guest.getByText('Votre inscription est confirmée.')).toBeVisible()

    // L'organisatrice la retrouve dans la session et dans la liste des inscriptions
    const session = await prisma.session.findUniqueOrThrow({ where: { slug: 'session-printemps' } })
    const participants = await (await page.request.get(`/api/sessions/${session.id}`)).json()
    expect(JSON.stringify(participants)).toContain('Camille Invitée')
    await page.goto('/registrations')
    await expect(page.getByText('Confirmée', { exact: true })).toBeVisible()

    // Elle entre dans le circuit de paiement sans attendre le casting (US-007, R22)
    await page.goto('/sessions/session-printemps?tab=payments')
    await expect(page.getByText('Camille Invitée').first()).toBeVisible()
    await expect(page.getByText('Personnage à attribuer')).toBeVisible()
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})
