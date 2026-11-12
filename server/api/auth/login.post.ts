import { purgeRetention } from '~/server/utils/retention'
import { purgeExpiredPhotos } from '~/server/utils/photoRetention'
import { prisma } from '~/server/utils/prisma'
import { passwordMatches } from '~/server/utils/passwordHash'
import { setAuthCookie, touchAccount } from '~/server/utils/auth'
import { loginSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { purgeUnconfirmedAccounts } from '~/server/utils/accounts'
import { purgeExpiredCopies } from '~/server/utils/deliveryCopies'
import { purgeAiData } from '~/server/utils/aiAuth'
import { purgeRegistrationRequests } from '~/server/utils/formRegistrations'

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

  // Même coût de calcul que l'email existe ou non, et qu'il soit activé ou pré-créé (ADR-0088) : le temps de réponse ne
  // révèle pas les comptes
  const passwordMatch = await passwordMatches(password, user?.password)

  // 401 et non 200 { success: false } : l'écran de connexion n'affiche l'erreur que si la requête échoue
  if (!user || !passwordMatch) {
    throw createError({ statusCode: 401, message: 'Email ou mot de passe incorrect' })
  }
  // Compte désactivé par l'administratrice (US-065). Une adresse non confirmée se connecte, pour renvoyer le lien (R5)
  if (user.disabledAt) {
    throw createError({ statusCode: 403, message: 'Ce compte est désactivé. Contactez l’administratrice de Limbus.' })
  }

  // Après une connexion réussie seulement, pour qu'une tentative refusée ne parcoure pas les sessions, et en
  // parallèle : copies des envois des sessions passées (US-080, ADR-0044), formulaires publics jamais confirmés
  // (R11, ADR-0046), photos échues (US-108, ADR-0054), autorisations des assistants finies (US-121). Attendues : le
  // ménage est fait quand la connexion répond.
  await Promise.all([purgeExpiredCopies(), purgeRegistrationRequests(), purgeExpiredPhotos(), purgeAiData()])
  // Activité du compte, puis comptes inactifs et fiches sans compte trop anciens (US-112, US-113), en tâche de fond :
  // la purge parcourt tous les comptes
  await touchAccount(user.id, null)
  purgeRetention().catch((error) => console.error('[conservation] purge non effectuée', { error: (error as Error)?.message }))
  setAuthCookie(event, user)

  return { success: true }
})
