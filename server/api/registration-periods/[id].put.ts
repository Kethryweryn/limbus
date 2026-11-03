import { requireUser } from '~/server/utils/auth'
import { readZodBody, registrationPeriodUpdateSchema } from '~/server/utils/schemas'
import { updateRegistrationPeriod } from '~/server/utils/registrationPeriodWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/registrationPeriodWrites.ts, US-130)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await updateRegistrationPeriod(event, getRouterParam(event, 'id'), () => readZodBody(event, registrationPeriodUpdateSchema))
})
