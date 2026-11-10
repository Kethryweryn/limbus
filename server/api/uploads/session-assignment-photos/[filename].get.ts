import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { requireUser } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { uploadDir, UPLOAD_DIRS } from '~/server/utils/uploads'
import { requireGameAccess, requireSessionAccess } from '~/server/utils/gameAccess'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const rawFilename = getRouterParam(event, 'filename')
  const filename = basename(rawFilename || '')

  if (!filename || filename !== rawFilename) {
    throw createError({ statusCode: 400, message: 'Nom de fichier invalide' })
  }

  const filePath = join(uploadDir(UPLOAD_DIRS.photos), filename)
  const contentType = CONTENT_TYPES[extname(filename)]

  if (!contentType) {
    throw createError({ statusCode: 404, message: 'Fichier introuvable' })
  }

  const uploadedFile = await prisma.uploadedFile.findUnique({
    where: { filename },
    select: { kind: true, gameId: true, sessionId: true }
  })
  if (!uploadedFile || uploadedFile.kind !== 'sessionAssignmentPhoto') {
    throw createError({ statusCode: 404, message: 'Fichier introuvable' })
  }
  if (uploadedFile.sessionId) {
    await requireSessionAccess(event, uploadedFile.sessionId)
  } else if (uploadedFile.gameId) {
    await requireGameAccess(event, uploadedFile.gameId)
  } else {
    throw createError({ statusCode: 404, message: 'Fichier introuvable' })
  }

  let size: number
  try {
    size = (await stat(filePath)).size
  } catch {
    throw createError({ statusCode: 404, message: 'Fichier introuvable' })
  }

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'private, no-store')
  // La place prise par les photos gardées sur l'appareil se lit dans cet en-tête (SPEC-019, R2)
  setHeader(event, 'Content-Length', size)
  return sendStream(event, createReadStream(filePath))
})
