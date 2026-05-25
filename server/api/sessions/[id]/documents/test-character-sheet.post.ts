import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { emailTestSchema, readZodBody } from '~/server/utils/schemas'
import { sendCharacterSheetBundleTestEmail } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireSessionAccess(event, id)

  const body = await readZodBody(event, emailTestSchema)
  if (!body.characterId) {
    throw createError({ statusCode: 400, message: 'Personnage manquant' })
  }

  return await sendCharacterSheetBundleTestEmail(id, body.characterId, body.emails)
})
