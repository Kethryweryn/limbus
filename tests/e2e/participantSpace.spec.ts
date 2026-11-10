// US-202 (EPIC-050, lot 5) : l'espace « Je participe », le lien public d'inscription (/i/…) et les assistants d'IA,
// sur les quatre axes (ADR-0079) : actions, erreurs de saisie, droits, hors ligne
import { createHash, randomBytes } from 'node:crypto'
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { TERMS_VERSION } from '../../utils/legal'
import { E2E_USERS } from './constants'
import { authorizationRequest, captureCallback, orgaGame, orgaSession, signIn, slugOf, test, testUser, uniqueName, type TestPrisma } from './helpers'

// Vivier ouvert d'un jeu propre au test, avec une session à venir proposée
async function openPeriod(prisma: TestPrisma, base: string, state: 'open' | 'closed' = 'open') {
  const game = await orgaGame(prisma, base)
  const session = await orgaSession(prisma, game.id, `Session de ${base}`, { date: new Date('2099-05-15T09:00:00Z') })
  const period = await prisma.registrationPeriod.create({
    data: { gameId: game.id, publicId: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, state, sessions: { create: { sessionId: session.id, open: true } } }
  })
  return { game, session, period }
}

// Personne au compte confirmé, dans le vivier du jeu, pré-inscrite à la session, avec son lien personnel
async function poolMember(prisma: TestPrisma, base: string) {
  const token = randomBytes(32).toString('base64url')
  const { game, session, period } = await openPeriod(prisma, base)
  const { user, email, name } = await testUser(prisma, `Joueuse ${base}`)
  const participant = await prisma.participant.create({ data: { name, slug: slugOf(name), email, userId: user.id, gameLinks: { create: { gameId: game.id } } } })
  const registration = await prisma.registration.create({
    data: {
      gameId: game.id, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email,
      firstName: 'Ana', lastName: 'Lys', phone: '0611111111', emergencyContactName: 'Paul', emergencyContactPhone: '0622222222', charterAcceptedAt: new Date(),
      sessionLines: { create: { sessionId: session.id, status: 'preregistered', answer: 'available' } },
      links: { create: { tokenHash: createHash('sha256').update(token).digest('hex') } }
    }
  })
  return { game, session, period, user, email, participant, registration, token }
}

// Document reçu par la personne pour la session
async function delivered(prisma: TestPrisma, member: Awaited<ReturnType<typeof poolMember>>, body: string) {
  await prisma.sessionParticipant.create({ data: { sessionId: member.session.id, participantId: member.participant.id, role: 'participant' } })
  const title = uniqueName('Lettre')
  const document = await prisma.document.create({ data: { title, slug: slugOf(title), gameId: member.game.id, content: 'Brouillon', readyToSend: true } })
  const delivery = await prisma.sessionDocumentDelivery.create({
    data: {
      gameId: member.game.id, sessionId: member.session.id, participantId: member.participant.id, documentId: document.id, kind: 'document',
      copyPdf: Buffer.from('%PDF-1.4'), copyContent: { kind: 'text', title, subtitle: member.session.name, sections: [{ title: 'Contenu', body }] }, copySize: 100
    }
  })
  return { id: delivery.id, title }
}

async function fillPublicForm(page: Page, email: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Prénom').fill('Marie')
  await page.getByLabel('Nom', { exact: true }).fill('Curie')
  await page.getByLabel('Téléphone', { exact: true }).fill('0612345678')
  await page.getByLabel('Contact d’urgence : nom').fill('Pierre')
  await page.getByLabel('Contact d’urgence : téléphone').fill('0698765432')
  await page.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
}

test.describe('lien public d’inscription', () => {
  test('un formulaire vide ou une adresse invalide est refusé avec ses messages, sans rien enregistrer', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { period } = await openPeriod(prisma, 'Vivier refus')
      await page.goto(`/i/${period.publicId}`)
      await page.waitForLoadState('networkidle')

      await page.getByRole('button', { name: 'M’inscrire' }).click()
      await expect(page.getByText('Certaines informations sont manquantes ou incorrectes.')).toBeVisible()
      await expect(page.getByText(/Email invalide|L’email est obligatoire/).first()).toBeVisible()

      await fillPublicForm(page, 'adresse-sans-arobase')
      await page.getByRole('button', { name: 'M’inscrire' }).click()
      await expect(page.getByText(/Email invalide/).first()).toBeVisible()

      expect(await prisma.registration.count({ where: { periodId: period.id } })).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('un vivier fermé ne propose pas le formulaire, et un lien inconnu est invalide', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { game, period } = await openPeriod(prisma, 'Vivier fermé', 'closed')
      await page.goto(`/i/${period.publicId}`)
      await expect(page.getByRole('heading', { name: game.title })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Inscriptions closes' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'M’inscrire' })).toBeHidden()

      await page.goto('/i/lien-qui-n-existe-pas')
      await expect(page.getByRole('heading', { name: 'Lien invalide' })).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('connectée, la personne voit ses coordonnées, est reçue sans email, et retrouve le jeu dans « Je participe »', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { game, session, period } = await openPeriod(prisma, 'Vivier compte')
      const { email } = await testUser(prisma, 'Inscrite connectée')
      await signIn(page, prisma, email)
      await page.goto(`/i/${period.publicId}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('Vous êtes connecté·e')).toBeVisible()
      await expect(page.getByLabel('Email')).toHaveValue(email)
      await expect(page.getByLabel('Email')).toBeDisabled()

      await page.getByLabel('Prénom').fill('Rosa')
      await page.getByLabel('Nom', { exact: true }).fill('Luxe')
      await page.getByLabel('Téléphone', { exact: true }).fill('0612345678')
      await page.getByLabel('Contact d’urgence : nom').fill('Karl')
      await page.getByLabel('Contact d’urgence : téléphone').fill('0698765432')
      await page.getByLabel(new RegExp(`^${session.name}`)).check()
      await page.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
      await page.getByRole('button', { name: 'M’inscrire' }).click()
      await expect(page.getByText('Votre réponse est reçue.')).toBeVisible()

      await page.goto('/participer')
      await expect(page.getByRole('heading', { name: game.title })).toBeVisible()
      await expect(page.getByText(session.name).first()).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, l’envoi est refusé et le dit', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const { period } = await openPeriod(prisma, 'Vivier hors ligne')
      await page.goto(`/i/${period.publicId}`)
      await page.waitForLoadState('networkidle')
      await fillPublicForm(page, `${slugOf(uniqueName('hors-ligne'))}@example.test`)
      await context.setOffline(true)
      await page.getByRole('button', { name: 'M’inscrire' }).click()
      await expect(page.getByText(/Pas de réseau : cette action demande une connexion/)).toBeVisible()
      await context.setOffline(false)
      expect(await prisma.registration.count({ where: { periodId: period.id } })).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('« Je participe »', () => {
  test('l’inscription s’ouvre, se modifie, et refuse un champ obligatoire vidé', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const member = await poolMember(prisma, 'Inscription modifiée')
      await signIn(page, prisma, member.email)
      await page.goto('/participer')
      await page.getByRole('link', { name: 'Voir ou modifier' }).click()
      await expect(page.getByRole('heading', { name: member.game.title })).toBeVisible()
      await page.waitForLoadState('networkidle')
      await expect(page.locator(`[data-session="${member.session.name}"]`).getByText('Pré-inscrite')).toBeVisible()

      await page.getByLabel('Prénom').fill('')
      await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
      await expect(page.getByText('Certaines informations sont manquantes ou incorrectes.')).toBeVisible()
      expect((await prisma.registration.findUniqueOrThrow({ where: { id: member.registration.id } })).firstName).toBe('Ana')

      await page.getByLabel('Prénom').fill('Anaïs')
      await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
      await expect(page.getByText('Vos modifications sont enregistrées.')).toBeVisible()
      expect((await prisma.registration.findUniqueOrThrow({ where: { id: member.registration.id } })).firstName).toBe('Anaïs')
    } finally {
      await prisma.$disconnect()
    }
  })

  test('l’inscription et le document d’une autre personne sont introuvables', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const other = await poolMember(prisma, 'Autre joueuse')
      const letter = await delivered(prisma, other, 'Secret de l’autre.')
      const { email } = await testUser(prisma, 'Curieuse')
      await signIn(page, prisma, email)

      await page.goto(`/participer/inscriptions/${other.registration.id}`)
      await expect(page.getByRole('heading', { name: 'Inscription introuvable' })).toBeVisible()
      await expect(page.getByText(other.game.title)).toBeHidden()

      await page.goto(`/participer/documents/${letter.id}`)
      await expect(page.getByText(/Document introuvable|introuvable/i).first()).toBeVisible()
      await expect(page.getByText('Secret de l’autre.')).toBeHidden()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, la liste et un document déjà lus se relisent ; l’inscription dit qu’il faut le réseau', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const member = await poolMember(prisma, 'Joueuse hors ligne')
      const letter = await delivered(prisma, member, 'Rendez-vous au moulin.')
      await signIn(page, prisma, member.email)
      await page.goto('/participer')
      await page.getByRole('link', { name: letter.title }).click()
      await expect(page.getByText('Rendez-vous au moulin.')).toBeVisible()
      await page.getByRole('link', { name: 'Je participe' }).click()
      await expect(page.getByRole('heading', { name: 'Je participe' })).toBeVisible()
      await expect(page.getByRole('heading', { name: member.game.title })).toBeVisible()

      await context.setOffline(true)
      await page.getByRole('link', { name: letter.title }).click()
      await expect(page.getByText('Rendez-vous au moulin.')).toBeVisible()
      await page.getByRole('link', { name: 'Je participe' }).click()
      await expect(page.getByRole('heading', { name: member.game.title })).toBeVisible()
      await page.getByRole('link', { name: 'Voir ou modifier' }).click()
      await expect(page.getByText(/Pas de réseau : cette page demande une connexion/)).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Inscription introuvable' })).toBeHidden()
      await context.setOffline(false)
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('inscription qui ne se charge pas', () => {
  test('une panne du serveur ne la dit pas introuvable', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const member = await poolMember(prisma, 'Inscription en panne')
      await signIn(page, prisma, member.email)
      await page.route('**/api/me/registrations/**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
      await page.goto(`/participer/inscriptions/${member.registration.id}`)
      await expect(page.getByRole('heading', { name: 'Inscription indisponible' })).toBeVisible()
      await expect(page.getByText('Impossible de charger cette inscription. Réessayez dans quelques minutes.')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Inscription introuvable' })).toBeHidden()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('depuis le compte, une session expirée renvoie à l’écran de connexion', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const member = await poolMember(prisma, 'Session expirée')
      await signIn(page, prisma, member.email)
      await page.goto('/participer')
      await expect(page.getByRole('link', { name: 'Voir ou modifier' })).toBeVisible()
      // Sessions révoquées ailleurs (« Déconnecter tous mes appareils ») : le cookie ne vaut plus
      await prisma.user.update({ where: { id: member.user.id }, data: { sessionVersion: { increment: 1 } } })
      await page.getByRole('link', { name: 'Voir ou modifier' }).click()
      await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('sans réseau, le lien personnel n’est pas dit invalide, et rien n’est confirmé', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const member = await poolMember(prisma, 'Lien sans réseau')
      const confirmations: string[] = []
      page.on('request', (request) => {
        if (request.url().endsWith('/confirm')) confirmations.push(request.url())
      })
      await page.route('**/api/public/registrations/**', (route) => route.abort('internetdisconnected'))
      await page.goto(`/inscription/${member.token}`)
      await expect(page.getByText(/Pas de réseau : cette page demande une connexion/)).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Lien invalide' })).toBeHidden()
      expect(confirmations).toEqual([])

      // Le réseau revenu, le même lien ouvre l'inscription
      await page.unroute('**/api/public/registrations/**')
      await page.reload()
      await expect(page.getByRole('heading', { name: member.game.title })).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('assistants d’IA', () => {
  test('une co-organisatrice ne propose un jeu partagé que si la propriétaire l’ouvre aux assistants', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const closed = await orgaGame(prisma, 'Jeu fermé aux IA')
      const opened = await orgaGame(prisma, 'Jeu ouvert aux IA')
      await prisma.game.update({ where: { id: opened.id }, data: { aiForCoorganizers: true } })
      const coOrgaClient = uniqueName('Assistant co-orga')
      const { user, email } = await testUser(prisma, 'Co-orga IA')
      await prisma.gameShare.createMany({ data: [{ gameId: closed.id, userId: user.id }, { gameId: opened.id, userId: user.id }] })
      await signIn(page, prisma, email)

      await page.goto(await authorizationRequest(page, coOrgaClient))
      await page.waitForLoadState('networkidle')
      await expect(page.getByLabel(`${opened.title} (partagé avec vous)`)).toBeVisible()
      await expect(page.getByText(closed.title)).toBeHidden()

      const callback = await captureCallback(page)
      await page.getByLabel(`${opened.title} (partagé avec vous)`).check()
      await page.getByRole('button', { name: 'Autoriser' }).click()
      await expect.poll(() => callback.url).toContain('code=')

      // La propriétaire referme le jeu : le compte le montre fermé, et ne le propose plus
      await prisma.game.update({ where: { id: opened.id }, data: { aiForCoorganizers: false } })
      await page.goto('/compte')
      await page.waitForLoadState('networkidle')
      const card = page.locator('div.rounded').filter({ hasText: coOrgaClient }).first()
      await expect(card.getByText(`${opened.title} (fermé aux assistants par sa propriétaire)`)).toBeVisible()
      await card.getByRole('button', { name: 'Changer les jeux' }).click()
      await expect(card.getByLabel(new RegExp(opened.title))).toBeHidden()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('refuser renvoie un refus à l’assistant, et une demande inconnue le dit', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const deniedClient = uniqueName('Assistant refusé')
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(await authorizationRequest(page, deniedClient))
      await page.waitForLoadState('networkidle')
      const callback = await captureCallback(page)
      await page.getByRole('button', { name: 'Refuser' }).click()
      await expect.poll(() => callback.url).toContain('error=access_denied')
      // La page finit d'aller à l'adresse de retour avant d'en ouvrir une autre
      await page.waitForURL(/localhost:9999/)
      expect(await prisma.aiAuthorization.count({ where: { client: { name: deniedClient } } })).toBe(0)

      await page.goto('/autoriser/demande-inconnue')
      await expect(page.getByText('Demande d’autorisation expirée : relancez la connexion depuis votre assistant.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Autoriser' })).toBeHidden()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('les jeux d’un assistant se changent depuis le compte', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const settingsClient = uniqueName('Assistant à régler')
      const game = await orgaGame(prisma, 'Jeu retiré de l’IA')
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(await authorizationRequest(page, settingsClient))
      await page.waitForLoadState('networkidle')
      const callback = await captureCallback(page)
      await page.getByLabel(game.title, { exact: true }).check()
      await page.getByRole('button', { name: 'Autoriser' }).click()
      await expect.poll(() => callback.url).toContain('code=')

      await page.goto('/compte')
      await page.waitForLoadState('networkidle')
      const card = page.locator('div.rounded').filter({ hasText: settingsClient }).first()
      await expect(card.getByText(game.title)).toBeVisible()
      await card.getByRole('button', { name: 'Changer les jeux' }).click()
      await card.getByLabel(game.title, { exact: true }).uncheck()
      await card.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(card.getByText('Aucun jeu.')).toBeVisible()
      const authorization = await prisma.aiAuthorization.findFirstOrThrow({ where: { client: { name: settingsClient } }, include: { games: true } })
      expect(authorization.games).toEqual([])
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, autoriser est refusé et le dit', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const offlineClient = uniqueName('Assistant hors ligne')
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(await authorizationRequest(page, offlineClient))
      await page.waitForLoadState('networkidle')
      await context.setOffline(true)
      await page.getByRole('button', { name: 'Autoriser' }).click()
      await expect(page.getByText(/Pas de réseau : cette action demande une connexion/)).toBeVisible()
      // Le bandeau dit ce qui attend la connexion (US-219)
      await expect(page.getByText('Les envois et les autres actions attendent la connexion.', { exact: false })).toBeVisible()
      await context.setOffline(false)
      expect(await prisma.aiAuthorization.count({ where: { client: { name: offlineClient } } })).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('autres écrans qui disent le réseau absent (US-217)', () => {
  test('hors ligne, le réglage des assistants d’un jeu est refusé, et ne part pas au retour du réseau', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Jeu réglage IA hors ligne')
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(`/games/${game.slug}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Partager' }).click()
      const toggle = page.getByRole('switch', { name: 'Les co-organisatrices peuvent y brancher une IA' })
      await expect(page.getByText('Aucun assistant n’a accès à ce jeu.')).toBeVisible()

      await context.setOffline(true)
      await toggle.click()
      await expect(page.getByRole('dialog').getByText(/Pas de réseau : cette action demande une connexion/)).toBeVisible()
      await expect(toggle).not.toBeChecked()
      // Rien n'est mis en attente : le retour du réseau n'envoie pas le réglage refusé
      await expect(page.getByText(/\d+ en attente/)).toBeHidden()
      // Au rechargement, les modifications en attente partent (US-052) : aucune ne doit porter ce réglage
      await context.setOffline(false)
      await page.reload()
      await page.waitForLoadState('networkidle')
      expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).aiForCoorganizers).toBe(false)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, retirer un assistant du compte est refusé et le dit', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const client = uniqueName('Assistant à garder')
      const { email } = await testUser(prisma, 'Compte IA hors ligne')
      await signIn(page, prisma, email)
      await page.goto(await authorizationRequest(page, client))
      await page.waitForLoadState('networkidle')
      const callback = await captureCallback(page)
      await page.getByRole('button', { name: 'Autoriser' }).click()
      await expect.poll(() => callback.url).toContain('code=')

      await page.goto('/compte')
      await page.waitForLoadState('networkidle')
      const card = page.locator('div.rounded').filter({ hasText: client }).first()
      await context.setOffline(true)
      page.once('dialog', (dialog) => dialog.accept())
      await card.getByRole('button', { name: 'Retirer' }).click()
      await expect(page.getByText(/Pas de réseau : cette action demande une connexion/)).toBeVisible()
      await context.setOffline(false)
      expect(await prisma.aiAuthorization.count({ where: { client: { name: client } } })).toBe(1)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('un document ou un événement jamais lu sur l’appareil le dit, sans réseau', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Jeu fiches jamais lues')
      const title = uniqueName('Document jamais lu')
      await prisma.document.create({ data: { title, slug: slugOf(title), gameId: game.id, content: 'Texte' } })
      const name = uniqueName('Événement jamais lu')
      await prisma.timelineEvent.create({ data: { name, slug: slugOf(name), gameId: game.id, day: 1, time: '10:00' } })
      await signIn(page, prisma, E2E_USERS.orga)
      await page.route('**/api/documents/slug/**', (route) => route.abort('internetdisconnected'))
      await page.route('**/api/timeline-events/slug/**', (route) => route.abort('internetdisconnected'))

      await page.goto(`/documents/${slugOf(title)}`)
      await expect(page.getByText('Cette page n’a pas été consultée avec le réseau sur cet appareil', { exact: false })).toBeVisible()
      await expect(page.getByText('Document introuvable.')).toBeHidden()
      await page.goto(`/timeline/${slugOf(name)}`)
      await expect(page.getByText('Cette page n’a pas été consultée avec le réseau sur cet appareil', { exact: false })).toBeVisible()
      await expect(page.getByText('Événement introuvable.')).toBeHidden()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('sans réseau, accepter les conditions ou renvoyer le lien de confirmation le dit', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { user, email } = await testUser(prisma, 'Conditions sans réseau')
      await signIn(page, prisma, email)
      await page.route('**/api/auth/accept-terms', (route) => route.abort('internetdisconnected'))
      await page.route('**/api/auth/resend-confirmation', (route) => route.abort('internetdisconnected'))

      await prisma.user.update({ where: { id: user.id }, data: { termsAcceptedVersion: null } })
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Conditions d’utilisation' })).toBeVisible()
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'J’accepte' }).click()
      await expect(page.getByText(/Pas de réseau : cette action demande une connexion/)).toBeVisible()

      await prisma.user.update({ where: { id: user.id }, data: { termsAcceptedVersion: TERMS_VERSION, emailConfirmedAt: null } })
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Confirmez votre adresse' })).toBeVisible()
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Renvoyer le lien' }).click()
      await expect(page.getByText(/Pas de réseau : cette action demande une connexion/)).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })
})
