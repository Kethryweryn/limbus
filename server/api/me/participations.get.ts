import { requireUser } from '~/server/utils/auth'
import { myParticipations } from '~/server/utils/participations'

// Espace « Je participe » (US-071) : les jeux, sessions, inscriptions et paiements des fiches rattachées au compte
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return await myParticipations(user.id)
})
