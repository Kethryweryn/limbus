import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { getAllergySheet, renderAllergySheetPdf } from '~/server/utils/allergies'

// Fiche allergies en PDF, générée à la demande et jamais stockée (US-008)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const session = await requireSessionAccess(event, getRouterParam(event, 'id') || '')
  const pdf = await renderAllergySheetPdf(await getAllergySheet(session.id))
  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `inline; filename="${pdf.filename}"`)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'private, no-store')

  return Buffer.from(pdf.bytes)
})
