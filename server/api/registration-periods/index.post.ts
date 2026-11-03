import { requireUser } from '~/server/utils/auth'
import { readZodBody, registrationPeriodSchema } from '~/server/utils/schemas'
import { createRegistrationPeriod } from '~/server/utils/registrationPeriodWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/registrationPeriodWrites.ts, US-130)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await createRegistrationPeriod(event, () => readZodBody(event, registrationPeriodSchema))
})
