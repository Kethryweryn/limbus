import bcrypt from 'bcrypt'
import { setCookie } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { signAuthToken } from '~/server/utils/auth'
import { loginSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'

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

  if (!user) {
    return { success: false, message: 'Email ou mot de passe incorrect' }
  }

  const passwordMatch = await bcrypt.compare(password, user.password)

  if (!passwordMatch) {
    return { success: false, message: 'Email ou mot de passe incorrect' }
  }

  const token = signAuthToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  })

  setCookie(event, 'limbus_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 20// 20 heures
  })

  return { success: true }
})
