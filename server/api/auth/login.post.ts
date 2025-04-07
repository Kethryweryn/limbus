import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { setCookie } from 'h3'

const prisma = new PrismaClient()
const SECRET = 'limbus-super-secret'

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

  const token = jwt.sign(
    { email: user.email, role: user.role },
    SECRET,
    { expiresIn: '20h' }
  )

  setCookie(event, 'limbus_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 20// 1 heure
  })

  return { success: true }
})
