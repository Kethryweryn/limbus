import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { accountUpdateSchema, readZodBody } from '~/server/utils/schemas'
import { syncProfileToParticipants } from '~/server/utils/participantAccounts'

// Changer son nom (US-063)
export default defineEventHandler(async (event) => {
  const { id } = await requireUser(event)
  const body = await readZodBody(event, accountUpdateSchema)
  const user = await prisma.user.update({ where: { id }, data: { name: body.name }, select: { id: true, name: true } })
  // Le nom fait partie des coordonnées recopiées sur les fiches (US-074)
  await syncProfileToParticipants(id)
  return user
})
