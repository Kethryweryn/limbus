import { requireUser } from '~/server/utils/auth'
import { listAccountAuthorizations } from '~/server/utils/aiAccess'
import { offeredAiGames } from '~/server/utils/aiAuth'

// Assistants connectés du compte (US-123), et les jeux qu'on peut leur ouvrir
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const [authorizations, games] = await Promise.all([listAccountAuthorizations(user.id), offeredAiGames(user.id)])
  return { authorizations, games }
})
