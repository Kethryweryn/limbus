import { prisma } from '~/server/utils/prisma'
import { setAuthCookie } from '~/server/utils/auth'
import { acceptInvitationForUser, createInvitedUser, getValidInvitation, normalizeInvitationEmail } from '~/server/utils/invitations'
import { invitationRegistrationSchema, readZodBody } from '~/server/utils/schemas'
import { hashPassword } from '~/server/utils/accounts'
import { linkParticipantsToUser } from '~/server/utils/participantAccounts'

export default defineEventHandler(async (event) => {
  const body = await readZodBody(event, invitationRegistrationSchema)
  // Le compte prend l'adresse invitée (US-064) : le lien reçu la prouve, il est confirmé d'emblée.
  // Ouvert même inscription libre fermée : c'est une invitation
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

  const password = await hashPassword(body.password)
  const user = await createInvitedUser(email, body.name, password)
  await linkParticipantsToUser(user)
  // Connectée dès la création : si l'acceptation échoue (legs annulé entre-temps…), elle n'a pas à recréer son compte
  setAuthCookie(event, { id: user.id, sessionVersion: 0 })
  const game = await acceptInvitationForUser(body.token, user.id)

  return { success: true, user, game }
})
