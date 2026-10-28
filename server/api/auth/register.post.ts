import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { setAuthCookie } from '~/server/utils/auth'
import { acceptInvitationForUser, createInvitedUser, getValidInvitation, normalizeInvitationEmail } from '~/server/utils/invitations'
import { invitationRegistrationSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readZodBody(event, invitationRegistrationSchema)
  await getValidInvitation(body.token)
  const email = normalizeInvitationEmail(body.email)

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  })
  if (existingUser) {
    throw createError({
      statusCode: 409,
      message: 'Un compte existe déjà pour cette adresse. Connectez-vous pour accepter l’invitation.'
    })
  }

  const password = await bcrypt.hash(body.password, 10)
  const user = await createInvitedUser(email, body.name, password)
  // Connectée dès la création : si l'acceptation échoue (legs annulé entre-temps…), elle n'a pas à recréer son compte
  setAuthCookie(event, { id: user.id, sessionVersion: 0 })
  const game = await acceptInvitationForUser(body.token, user.id)

  return { success: true, user, game }
})
