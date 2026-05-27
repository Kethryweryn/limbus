import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { requireOrganizer } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { requireSessionAccess } from '~/server/utils/gameAccess'

const MAX_SIZE = 10 * 1024 * 1024

function getUploadDir() {
  return join(process.cwd(), '.data', 'uploads', 'session-payment-ribs')
}

function hasPdfSignature(data: Buffer) {
  return data.length >= 5 && data.subarray(0, 5).toString('ascii') === '%PDF-'
}

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'rib')
  const sessionId = parts?.find((part) => part.name === 'sessionId')?.data?.toString('utf8')?.trim()

  if (!file?.data?.length) {
    throw createError({ statusCode: 400, message: 'RIB PDF requis' })
  }
  if (!sessionId) {
    throw createError({ statusCode: 400, message: 'Session requise' })
  }

  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, message: 'RIB trop volumineux' })
  }

  if (file.type !== 'application/pdf') {
    throw createError({ statusCode: 400, message: 'Le RIB doit être un PDF' })
  }
  if (!hasPdfSignature(file.data)) {
    throw createError({ statusCode: 400, message: 'Contenu PDF invalide' })
  }

  const filename = `${randomUUID()}.pdf`
  const uploadDir = getUploadDir()
  const session = await requireSessionAccess(event, sessionId)

  await mkdir(uploadDir, { recursive: true })
  await writeFile(join(uploadDir, filename), file.data)
  const ribUrl = `/api/uploads/session-payment-ribs/${filename}`
  await prisma.uploadedFile.create({
    data: {
      kind: 'session-payment-rib',
      filename,
      url: ribUrl,
      gameId: session.gameId,
      sessionId: session.id
    }
  })

  return {
    ribUrl
  }
})
