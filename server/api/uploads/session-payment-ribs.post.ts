import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { requireOrganizer } from '~/server/utils/auth'

const MAX_SIZE = 10 * 1024 * 1024

function getUploadDir() {
  return join(process.cwd(), '.data', 'uploads', 'session-payment-ribs')
}

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'rib')

  if (!file?.data?.length) {
    throw createError({ statusCode: 400, message: 'RIB PDF requis' })
  }

  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, message: 'RIB trop volumineux' })
  }

  if (file.type !== 'application/pdf') {
    throw createError({ statusCode: 400, message: 'Le RIB doit être un PDF' })
  }

  const filename = `${randomUUID()}.pdf`
  const uploadDir = getUploadDir()

  await mkdir(uploadDir, { recursive: true })
  await writeFile(join(uploadDir, filename), file.data)

  return {
    ribUrl: `/api/uploads/session-payment-ribs/${filename}`
  }
})
