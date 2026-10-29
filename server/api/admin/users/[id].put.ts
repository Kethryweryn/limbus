import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'
import { readZodBody, userUpdateSchema } from '~/server/utils/schemas'
import { requireRouterParam } from '~/server/utils/routeParams'
import { USER_ROLES } from '~/utils/domain'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = requireRouterParam(event, 'id')

  const body = await readZodBody(event, userUpdateSchema)
  const data: Record<string, unknown> = {
    email: body.email,
    name: body.name,
    role: body.role
  }

  // Un nouveau mot de passe déconnecte toutes les sessions ouvertes de ce compte
  if (body.password) {
    data.password = await bcrypt.hash(body.password, 10)
    data.sessionVersion = { increment: 1 }
  }

  const select = { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true }
  if (!body.role || body.role === USER_ROLES.admin) {
    return await prisma.user.update({ where: { id }, data, select })
  }

  // Limbus garde toujours une administratrice (US-043). En transaction sérialisable : deux administratrices
  // qui se retirent leur rôle en même temps ne passent pas toutes les deux
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data, select })
      if (!await tx.user.count({ where: { role: USER_ROLES.admin } })) {
        throw createError({ statusCode: 409, message: 'C’est la dernière administratrice : nommez-en une autre avant de lui retirer ce rôle.' })
      }
      return updated
    }, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
      throw createError({ statusCode: 409, message: 'Un autre changement de rôle est en cours : réessayez.' })
    }
    throw error
  }
})
