import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'
import { readZodBody, userUpdateSchema } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }

  const body = await readZodBody(event, userUpdateSchema)
  const data: Record<string, unknown> = {
    email: body.email,
    name: body.name,
    role: body.role
  }

  if (body.password) {
    data.password = await bcrypt.hash(body.password, 10)
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
