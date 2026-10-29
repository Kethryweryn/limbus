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
      // En ligne comme au retour du mode hors ligne : la version lue n'est plus la dernière (ADR-0028)
      message: 'Cet élément a été modifié par quelqu’un d’autre entre-temps. Rechargez la page pour voir ses changements ; les vôtres n’ont pas été enregistrés.'
    })
  }
}
