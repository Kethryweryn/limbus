import { requireUser } from '~/server/utils/auth'
import { accountAiLog } from '~/server/utils/aiAccess'

// Journal des assistants du compte (US-123, SPEC-014 R13)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return await accountAiLog(user.id)
})
