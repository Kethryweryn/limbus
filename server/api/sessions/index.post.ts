import { requireUser } from '~/server/utils/auth'
import { readZodBody, sessionSchema } from '~/server/utils/schemas'
import { createSession } from '~/server/utils/sessionWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/sessionWrites.ts, US-127)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await createSession(event, () => readZodBody(event, sessionSchema))
})
