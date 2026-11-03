import { requireUser } from '~/server/utils/auth'
import { participantSchema, readZodBody } from '~/server/utils/schemas'
import { requireRouterParam } from '~/server/utils/routeParams'
import { updateParticipant } from '~/server/utils/participantWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/participantWrites.ts, US-129)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await updateParticipant(event, requireRouterParam(event, 'id'), () => readZodBody(event, participantSchema))
})
