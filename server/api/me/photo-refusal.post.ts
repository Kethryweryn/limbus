import { requireUser } from '~/server/utils/auth'
import { myParticipantIds } from '~/server/utils/participantAccounts'
import { setPhotoRefusal } from '~/server/utils/photoRetention'
import { photoRefusalSchema, readZodBody } from '~/server/utils/schemas'

// « Retirer mes photos » / « Accepter de nouveau une photo » (US-109) : sur toutes les fiches du compte (ADR-0041)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { refused } = await readZodBody(event, photoRefusalSchema)
  const result = await setPhotoRefusal(await myParticipantIds(user.id), refused)
  return { refused, ...result }
})
