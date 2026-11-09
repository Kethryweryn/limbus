// Liens entre éléments du contenu d'un jeu (US-191, ADR-0074) : ils passent par des tables de liaison qui portent le jeu.
// Une lecture inclut `characterLinks: { select: { character: true } }`, puis `unlinked` rend, à toute profondeur, la
// liste des éléments sous leur nom d'avant (`characters`) : l'API garde sa forme.

/** Élément relié, et nom de la liste rendue, pour chaque table de liaison. */
const LINKS = {
  characterLinks: ['character', 'characters'],
  factionLinks: ['faction', 'factions'],
  intrigueLinks: ['intrigue', 'intrigues'],
  itemLinks: ['item', 'items'],
  timelineEventLinks: ['timelineEvent', 'timelineEvents'],
  documentLinks: ['document', 'documents']
} as const

type LinkKey = keyof typeof LINKS
type Entity<K extends LinkKey> = typeof LINKS[K][0]
type Plural<K extends LinkKey> = typeof LINKS[K][1]
type Leaf = Date | Uint8Array | string | number | boolean | bigint | symbol | null | undefined

export type Unlinked<T> = T extends Leaf ? T
  : T extends ReadonlyArray<infer Element> ? Array<Unlinked<Element>>
    : { [K in keyof T as K extends LinkKey ? Plural<K> : K]: K extends LinkKey
      ? T[K] extends ReadonlyArray<infer Link> ? Link extends Record<Entity<K>, infer Element> ? Array<Unlinked<Element>> : never : never
      : Unlinked<T[K]> }

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function unlink(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unlink)
  if (!isPlainObject(value)) return value
  const result: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(value)) {
    const link = LINKS[key as LinkKey]
    if (link) {
      const [entity, plural] = link
      result[plural] = (field as Array<Record<string, unknown>>).map((row) => unlink(row[entity]))
    } else {
      result[key] = unlink(field)
    }
  }
  return result
}

/** Remplace, à toute profondeur, chaque liste de liens par la liste des éléments reliés. */
export function unlinked<T>(value: T): Unlinked<T> {
  return unlink(value) as Unlinked<T>
}

/** Liens à écrire vers des éléments du même jeu ; le jeu vient de l'élément qui les porte. */
export const linkCreate = <F extends string>(field: F, ids: readonly string[]) =>
  ({ create: ids.map((id) => ({ [field]: id }) as Record<F, string>) })

/** Remplace tous les liens d'une sorte. */
export const linkSet = <F extends string>(field: F, ids: readonly string[]) =>
  ({ deleteMany: {}, ...linkCreate(field, ids) })
