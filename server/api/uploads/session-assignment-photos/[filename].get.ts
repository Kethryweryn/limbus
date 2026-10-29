import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
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
    throw createError({ statusCode: 400, message: 'Invalid filename' })
  }

  const filePath = join(uploadDir(UPLOAD_DIRS.photos), filename)
  const contentType = CONTENT_TYPES[extname(filename)]

  if (!contentType) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  const uploadedFile = await prisma.uploadedFile.findUnique({
    where: { filename },
    select: { kind: true, gameId: true, sessionId: true }
  })
  if (!uploadedFile || uploadedFile.kind !== 'session-assignment-photo') {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  if (uploadedFile.sessionId) {
    await requireSessionAccess(event, uploadedFile.sessionId)
  } else if (uploadedFile.gameId) {
    await requireGameAccess(event, uploadedFile.gameId)
  } else {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  try {
    await access(filePath)
  } catch {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'private, no-store')
  return sendStream(event, createReadStream(filePath))
})
