import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { requireMySessionRib } from '~/server/utils/participations'
import { uploadFilePath } from '~/server/utils/uploads'

// RIB d'une session où l'une de mes fiches a un paiement (US-071, ADR-0041)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const ribUrl = await requireMySessionRib(user.id, requireRouterParam(event, 'id'))
  const filePath = uploadFilePath(ribUrl)
  // Un RIB externe (lien) se suit directement depuis la page
  if (!filePath) {
    throw createError({ statusCode: 404, message: 'RIB introuvable' })
  }
  try {
    await access(filePath)
  } catch {
    throw createError({ statusCode: 404, message: 'RIB introuvable' })
  }

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', 'inline; filename="rib.pdf"')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'private, no-store')
  return sendStream(event, createReadStream(filePath))
})
