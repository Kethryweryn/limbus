import { requireUser } from '~/server/utils/auth'
import { participantCreateSchema, readZodBody } from '~/server/utils/schemas'
import { createParticipant } from '~/server/utils/participantWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/participantWrites.ts, US-129)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await createParticipant(event, () => readZodBody(event, participantCreateSchema))
})
