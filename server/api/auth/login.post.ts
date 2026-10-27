import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { setAuthCookie } from '~/server/utils/auth'
import { loginSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'

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

  const user = await prisma.user.findUnique({
    where: { email }
  })

  // Même coût de calcul que l'email existe ou non : le temps de réponse ne révèle pas les comptes
  const passwordMatch = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH)

  // 401 et non 200 { success: false } : l'écran de connexion n'affiche l'erreur que si la requête échoue
  if (!user || !passwordMatch) {
    throw createError({ statusCode: 401, message: 'Email ou mot de passe incorrect' })
  }

  setAuthCookie(event, user)

  return { success: true }
})
