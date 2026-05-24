import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { requireOrganizer } from '~/server/utils/auth'

const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
])

const MAX_SIZE = 5 * 1024 * 1024

function getUploadDir() {
  return join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')
}

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'photo')

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

  const filename = `${randomUUID()}.${extension}`
  const uploadDir = getUploadDir()

  await mkdir(uploadDir, { recursive: true })
  await writeFile(join(uploadDir, filename), file.data)

  return {
    photoUrl: `/api/uploads/session-assignment-photos/${filename}`
  }
})
