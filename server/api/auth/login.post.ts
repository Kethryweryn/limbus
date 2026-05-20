import bcrypt from 'bcrypt'
import { setCookie } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { signAuthToken } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    return { success: false, message: 'Champs manquants' }
  }

  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    return { success: false, message: 'Utilisateur introuvable' }
  }

  const passwordMatch = await bcrypt.compare(password, user.password)

  if (!passwordMatch) {
    return { success: false, message: 'Mot de passe incorrect' }
  }

  const token = signAuthToken({ email: user.email, role: user.role })

  setCookie(event, 'limbus_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 20// 20 heures
  })

  return { success: true }
})
