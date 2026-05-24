import bcrypt from 'bcrypt'
import { setCookie } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { signAuthToken } from '~/server/utils/auth'
import { acceptInvitationForUser, createInvitedUser, getValidInvitation, normalizeInvitationEmail } from '~/server/utils/invitations'
import { invitationRegistrationSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readZodBody(event, invitationRegistrationSchema)
  const invitation = await getValidInvitation(body.token)
  const email = normalizeInvitationEmail(invitation.email)

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
  const game = await acceptInvitationForUser(body.token, user.id)
  const token = signAuthToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  })

  setCookie(event, 'limbus_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 20
  })

  return { success: true, user, game }
})
