import { prisma } from '~/server/utils/prisma'
import { refreshSessionLabels } from '~/server/utils/sessionLabels'

// Au démarrage (SPEC-021, R6 ; ADR-0083) : chaque session prend son libellé et son adresse. Rien n'est réécrit quand tout
// est à jour ; un échec (base absente pendant le prérendu…) n'empêche pas le serveur de démarrer
export default defineNitroPlugin(() => {
  if (import.meta.prerender) return
  void (async () => {
    const games = await prisma.game.findMany({ where: { sessions: { some: {} } }, select: { id: true } })
    for (const game of games) await prisma.$transaction((tx) => refreshSessionLabels(tx, game.id))
  })().catch((error) => console.error('[sessions] libellés non recalculés', { error: (error as Error)?.message }))
})
