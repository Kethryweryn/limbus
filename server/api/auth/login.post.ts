import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { setAuthCookie } from '~/server/utils/auth'
import { loginSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { purgeUnconfirmedAccounts } from '~/server/utils/accounts'
import { purgeExpiredCopies } from '~/server/utils/deliveryCopies'

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

  await purgeUnconfirmedAccounts()
  // Copies des envois des sessions passées (US-080, ADR-0044)
  await purgeExpiredCopies()
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

  setAuthCookie(event, user)

  return { success: true }
})
