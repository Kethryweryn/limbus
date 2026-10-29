import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { requireUser, setAuthCookie } from '~/server/utils/auth'
import { accountPasswordSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { hashPassword } from '~/server/utils/accounts'

// Changer son mot de passe (US-063) : les autres appareils sont déconnectés, celui-ci reçoit un nouveau jeton
export default defineEventHandler(async (event) => {
  const { id } = await requireUser(event)
  const body = await readZodBody(event, accountPasswordSchema)
  assertRateLimit(event, { name: 'account-password', limit: 10, windowMs: 15 * 60 * 1000, keyParts: [id] })

  const current = await prisma.user.findUniqueOrThrow({ where: { id }, select: { password: true } })
  if (!await bcrypt.compare(body.currentPassword, current.password)) {
    throw createError({ statusCode: 400, message: 'Mot de passe actuel incorrect.' })
  }
  const user = await prisma.user.update({
    where: { id },
    data: { password: await hashPassword(body.password), sessionVersion: { increment: 1 } },
    select: { id: true, sessionVersion: true }
  })
  setAuthCookie(event, user)
  return { success: true }
})
