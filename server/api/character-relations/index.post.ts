import { requireUser } from '~/server/utils/auth'
import { characterRelationSchema, readZodBody } from '~/server/utils/schemas'
import { createCharacterRelation } from '~/server/utils/contentWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/contentWrites.ts, US-126)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await createCharacterRelation(event, () => readZodBody(event, characterRelationSchema))
})
