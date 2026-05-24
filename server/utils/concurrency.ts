import { prisma } from '~/server/utils/prisma'

export async function assertUnmodifiedSince(event: any, model: string, id: string) {
  const raw = getHeader(event, 'if-unmodified-since')
  if (!raw) return

  const since = new Date(Array.isArray(raw) ? raw[0] : raw)
  if (Number.isNaN(since.getTime())) return

  const record = await (prisma as any)[model].findUnique({
    where: { id },
    select: { updatedAt: true }
  })

  if (!record?.updatedAt) return

  if (new Date(record.updatedAt).getTime() > since.getTime()) {
    throw createError({
      statusCode: 409,
      message: 'Cet élément a été modifié par quelqu’un d’autre pendant que vous étiez hors ligne. La synchronisation automatique a été arrêtée pour éviter d’écraser ses changements.'
    })
  }
}
