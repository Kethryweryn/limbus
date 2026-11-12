import { prisma } from '~/server/utils/prisma'
import { passwordMatches } from '~/server/utils/passwordHash'
import { clearAuthCookie, requireUser } from '~/server/utils/auth'
import { accountDeleteSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { deleteOwnAccount } from '~/server/utils/accountDeletion'

// Effacer mon compte (US-077) : mot de passe redemandé, effacement immédiat, déconnexion
export default defineEventHandler(async (event) => {
  const { id } = await requireUser(event)
  const body = await readZodBody(event, accountDeleteSchema)
  assertRateLimit(event, { name: 'account-delete', limit: 5, windowMs: 15 * 60 * 1000, keyParts: [id] })

  const { password } = await prisma.user.findUniqueOrThrow({ where: { id }, select: { password: true } })
  if (!await passwordMatches(body.password, password)) {
    throw createError({ statusCode: 400, message: 'Mot de passe incorrect.' })
  }

  const result = await deleteOwnAccount(id)
  clearAuthCookie(event)
  return { success: true, ...result }
})
