// Chemins relatifs : les jeux de test (`prisma/seed.ts`) importent ce fichier hors de Nuxt
import type { prisma, PrismaTx } from './prisma'
import { generateSlug } from './generateSlug'
import { sessionDayKey, sessionLabels } from '../../utils/sessionLabels'

// Libellé et adresse des sessions d'un jeu (SPEC-021, ADR-0083) : gardés dans `name` et `slug`, réécrits par toute
// écriture qui crée une session, change sa date ou son lieu, ou en supprime une

/** Premier libellé d'une session créée, avant son recalcul dans la même transaction. */
export const PENDING_SESSION_LABEL = 'Session'

/** Adresse de base d'une session (R5) : le jeu et le jour, ou « sans-date ». */
const baseSlug = (gameSlug: string, date: Date | null) => generateSlug(`${gameSlug} ${sessionDayKey(date) ?? 'sans date'}`) || 'session'
const fits = (slug: string, base: string) => slug === base || new RegExp(`^${base}-\\d+$`).test(slug)

/** Recalcule le libellé et l'adresse de chaque session du jeu, et réécrit seulement ceux qui changent. */
export async function refreshSessionLabels(db: PrismaTx | typeof prisma, gameId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { slug: true, sessions: { orderBy: { createdAt: 'asc' }, select: { id: true, name: true, slug: true, date: true, createdAt: true, location: { select: { name: true } } } } }
  })
  if (!game?.sessions.length) return
  const labels = sessionLabels(game.sessions.map((session) => ({ ...session, locationName: session.location?.name })))
  const bases = new Map(game.sessions.map((session) => [session.id, baseSlug(game.slug, session.date)]))
  const moving = game.sessions.filter((session) => !fits(session.slug, bases.get(session.id)!))
  // Adresses déjà prises, hors des sessions qui en changent
  const taken = new Set((await db.session.findMany({
    where: { OR: [...new Set(moving.map((session) => bases.get(session.id)!))].map((base) => ({ slug: { startsWith: base } })) },
    select: { id: true, slug: true }
  })).filter((row) => !moving.some((session) => session.id === row.id)).map((row) => row.slug))
  const slugs = new Map<string, string>()
  for (const session of moving) {
    const base = bases.get(session.id)!
    let slug = base
    for (let suffix = 2; taken.has(slug); suffix++) slug = `${base}-${suffix}`
    taken.add(slug)
    slugs.set(session.id, slug)
  }
  // Écrites sans toucher à leur version (`updatedAt`) : une page ouverte ou une modification hors ligne d'une voisine
  // reste valable, seul son libellé a changé. Une session peut prendre l'adresse qu'une autre quitte : celles qui en
  // changent la libèrent d'abord
  for (const session of moving) await db.$executeRaw`UPDATE "Session" SET "slug" = ${`session-${session.id}`} WHERE "id" = ${session.id}`
  for (const session of game.sessions) {
    const name = labels.get(session.id)!
    const slug = slugs.get(session.id) ?? session.slug
    if (name !== session.name || slug !== session.slug) await db.$executeRaw`UPDATE "Session" SET "name" = ${name}, "slug" = ${slug} WHERE "id" = ${session.id}`
  }
}
