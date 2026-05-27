import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { requireOrganizer } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { requireGameAccess, requireSessionAccess } from '~/server/utils/gameAccess'

const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
])

const MAX_SIZE = 5 * 1024 * 1024

function getUploadDir() {
  return join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')
}

function hasValidImageSignature(data: Buffer, extension: string) {
  if (extension === 'jpg') {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  }
  if (extension === 'png') {
    return data.length >= 8
      && data[0] === 0x89
      && data[1] === 0x50
      && data[2] === 0x4e
      && data[3] === 0x47
      && data[4] === 0x0d
      && data[5] === 0x0a
      && data[6] === 0x1a
      && data[7] === 0x0a
  }
  if (extension === 'webp') {
    return data.length >= 12
      && data.subarray(0, 4).toString('ascii') === 'RIFF'
      && data.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return false
}

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'photo')
  const sessionId = parts?.find((part) => part.name === 'sessionId')?.data?.toString('utf8')?.trim()
  const gameId = parts?.find((part) => part.name === 'gameId')?.data?.toString('utf8')?.trim()

  if (!file?.data?.length) {
    throw createError({ statusCode: 400, message: 'Photo is required' })
  }

  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, message: 'Photo is too large' })
  }

  const extension = ALLOWED_TYPES.get(file.type || '')
  if (!extension) {
    throw createError({ statusCode: 400, message: 'Unsupported photo format' })
  }
  if (!hasValidImageSignature(file.data, extension)) {
    throw createError({ statusCode: 400, message: 'Invalid photo content' })
  }

  const filename = `${randomUUID()}.${extension}`
  const uploadDir = getUploadDir()
  const session = sessionId ? await requireSessionAccess(event, sessionId) : null
  const linkedGameId = session?.gameId || gameId || null
  if (!linkedGameId) {
    throw createError({ statusCode: 400, message: 'Contexte de jeu ou de session requis' })
  }
  await requireGameAccess(event, linkedGameId)

  await mkdir(uploadDir, { recursive: true })
  await writeFile(join(uploadDir, filename), file.data)
  const photoUrl = `/api/uploads/session-assignment-photos/${filename}`
  await prisma.uploadedFile.create({
    data: {
      kind: 'session-assignment-photo',
      filename,
      url: photoUrl,
      gameId: linkedGameId,
      sessionId: session?.id || null
    }
  })

  return {
    photoUrl
  }
})
