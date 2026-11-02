import { requireUser } from '~/server/utils/auth'
import { itemSchema, readZodBody } from '~/server/utils/schemas'
import { createItem } from '~/server/utils/contentWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/contentWrites.ts, US-126)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await createItem(event, () => readZodBody(event, itemSchema))
})
