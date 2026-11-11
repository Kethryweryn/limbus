// Une session n'a pas de nom (SPEC-021, ADR-0084) : les tests lisent son libellé, calculé comme le serveur avec les autres
// sessions de son jeu, celui que l'écran et l'API donnent
import { labelSession } from '../server/utils/sessionLabels'

type LabelDb = Parameters<typeof labelSession>[0]

export async function labelled<T extends { id: string }>(prisma: unknown, session: T) {
  return await labelSession(prisma as LabelDb, session)
}

/** Date propre à un test : une année tirée au hasard, loin dans le futur, donne un libellé que les autres n'ont pas. */
export function uniqueDate(month = 3, day = 14) {
  return new Date(Date.UTC(2400 + Math.floor(Math.random() * 7000), month - 1, day, 12))
}
