import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { requireOrganizer } from '~/server/utils/auth'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

function getUploadDir() {
  return join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')
}

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const rawFilename = getRouterParam(event, 'filename')
  const filename = basename(rawFilename || '')

  if (!filename || filename !== rawFilename) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid filename' })
  }

  const filePath = join(getUploadDir(), filename)
  const contentType = CONTENT_TYPES[extname(filename)]

  if (!contentType) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  try {
    await access(filePath)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  setHeader(event, 'Content-Type', contentType)
  return sendStream(event, createReadStream(filePath))
})
