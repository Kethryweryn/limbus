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
  // Limbus garde toujours une administratrice (US-043) : la dernière ne perd pas son rôle
  if (body.role && body.role !== USER_ROLES.admin) {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (target?.role === USER_ROLES.admin && await prisma.user.count({ where: { role: USER_ROLES.admin } }) <= 1) {
      throw createError({ statusCode: 409, message: 'C’est la dernière administratrice : nommez-en une autre avant de lui retirer ce rôle.' })
    }
  }
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

  return await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  })
})
