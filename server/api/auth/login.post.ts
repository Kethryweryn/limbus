import { purgeRetention } from '~/server/utils/retention'
import { purgeExpiredPhotos } from '~/server/utils/photoRetention'
import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { setAuthCookie, touchAccount } from '~/server/utils/auth'
import { loginSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { purgeUnconfirmedAccounts } from '~/server/utils/accounts'
import { purgeExpiredCopies } from '~/server/utils/deliveryCopies'
import { purgeRegistrationRequests } from '~/server/utils/formRegistrations'

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('mot-de-passe-factice', 10)

export default defineEventHandler(async (event) => {
  const body = await readZodBody(event, loginSchema)
  const { email, password } = body
  assertRateLimit(event, {
    name: 'auth-login-ip',
    limit: 30,
    windowMs: 15 * 60 * 1000
  })
  assertRateLimit(event, {
    name: 'auth-login-email',
    limit: 10,
    windowMs: 15 * 60 * 1000,
    keyParts: [email]
  })

  // Avant la recherche du compte : un compte non confirmé échu ne se connecte plus
  await purgeUnconfirmedAccounts()
  const user = await prisma.user.findUnique({
    where: { email }
  })

  // Même coût de calcul que l'email existe ou non : le temps de réponse ne révèle pas les comptes
  const passwordMatch = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH)

  // 401 et non 200 { success: false } : l'écran de connexion n'affiche l'erreur que si la requête échoue
  if (!user || !passwordMatch) {
    throw createError({ statusCode: 401, message: 'Email ou mot de passe incorrect' })
  }
  // Compte désactivé par l'administratrice (US-065). Une adresse non confirmée se connecte, pour renvoyer le lien (R5)
  if (user.disabledAt) {
    throw createError({ statusCode: 403, message: 'Ce compte est désactivé. Contactez l’administratrice de Limbus.' })
  }

  // Après une connexion réussie seulement, pour qu'une tentative refusée ne parcoure pas les sessions : copies des
  // envois des sessions passées (US-080, ADR-0044), formulaires publics jamais confirmés (R11, ADR-0046), photos
  // des sessions passées depuis plus longtemps que la durée de leur jeu (US-108, ADR-0054)
  await purgeExpiredCopies()
  await purgeRegistrationRequests()
  await purgeExpiredPhotos()
  // Connexion : activité du compte, puis comptes inactifs et fiches sans compte trop anciens (US-112, US-113), en
  // tâche de fond pour ne pas ralentir la connexion
  await touchAccount(user.id, null)
  purgeRetention().catch((error) => console.error('[conservation] purge non effectuée', { error: (error as Error)?.message }))
  setAuthCookie(event, user)

  return { success: true }
})
