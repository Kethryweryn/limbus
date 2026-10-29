import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'
import { readZodBody, userUpdateSchema } from '~/server/utils/schemas'
import { requireRouterParam } from '~/server/utils/routeParams'
import { USER_ROLES } from '~/utils/domain'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAdmin(event)

  const id = requireRouterParam(event, 'id')

  const body = await readZodBody(event, userUpdateSchema)
  const data: Record<string, unknown> = {
    email: body.email,
    name: body.name,
    role: body.role,
    storageQuotaMb: body.storageQuotaMb
  }

  // Désactiver déconnecte le compte partout (US-065) ; on ne se désactive pas soi-même
  if (body.disabled !== undefined) {
    if (body.disabled && id === currentUser.id) {
      throw createError({ statusCode: 400, message: 'Vous ne pouvez pas désactiver votre propre compte.' })
    }
    const current = await prisma.user.findUnique({ where: { id }, select: { disabledAt: true } })
    if (body.disabled && !current?.disabledAt) {
      data.disabledAt = new Date()
      data.sessionVersion = { increment: 1 }
    } else if (!body.disabled && current?.disabledAt) {
      data.disabledAt = null
    }
  }

  const select = { id: true, email: true, name: true, role: true, disabledAt: true, storageQuotaMb: true, createdAt: true, updatedAt: true }
  if ((!body.role || body.role === USER_ROLES.admin) && !data.disabledAt) {
    return await prisma.user.update({ where: { id }, data, select })
  }

  // Limbus garde toujours une administratrice (US-043). En transaction sérialisable : deux administratrices
  // qui se retirent leur rôle en même temps ne passent pas toutes les deux
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data, select })
      // Une administratrice désactivée ne compte pas : elle ne peut plus se connecter
      if (!await tx.user.count({ where: { role: USER_ROLES.admin, disabledAt: null } })) {
        throw createError({ statusCode: 409, message: 'C’est la dernière administratrice active : nommez-en une autre avant de lui retirer ce rôle ou de la désactiver.' })
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
