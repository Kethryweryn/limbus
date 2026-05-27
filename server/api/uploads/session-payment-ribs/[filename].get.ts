import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { requireOrganizer } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { requireSessionAccess } from '~/server/utils/gameAccess'

function getUploadDir() {
  return join(process.cwd(), '.data', 'uploads', 'session-payment-ribs')
}

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const rawFilename = getRouterParam(event, 'filename')
  const filename = basename(rawFilename || '')

  if (!filename || filename !== rawFilename || extname(filename) !== '.pdf') {
    throw createError({ statusCode: 400, message: 'Nom de fichier invalide' })
  }

  const filePath = join(getUploadDir(), filename)
  const uploadedFile = await prisma.uploadedFile.findUnique({
    where: { filename },
    select: { kind: true, sessionId: true }
  })
  if (!uploadedFile || uploadedFile.kind !== 'session-payment-rib' || !uploadedFile.sessionId) {
    throw createError({ statusCode: 404, message: 'Fichier introuvable' })
  }
  await requireSessionAccess(event, uploadedFile.sessionId)

  try {
    await access(filePath)
  } catch {
    throw createError({ statusCode: 404, message: 'Fichier introuvable' })
  }

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="${filename}"`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'private, no-store')
  return sendStream(event, createReadStream(filePath))
})
