import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'
import { readZodBody, userCreateSchema } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readZodBody(event, userCreateSchema)

  const password = await bcrypt.hash(body.password, 10)
  return await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      password,
      role: body.role
    },
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
