import { requireUser } from '~/server/utils/auth'
import { factionSchema, readZodBody } from '~/server/utils/schemas'
import { createFaction } from '~/server/utils/contentWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/contentWrites.ts, US-126)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await createFaction(event, () => readZodBody(event, factionSchema))
})
