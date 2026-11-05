// Empreintes de ce qui part à une personne, pour repérer une version dépassée. Sans import `~/` : `prisma/seed` s'en sert hors de Nuxt.
import { createHash } from 'node:crypto'

const contentHash = (parts: unknown[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex')

export function documentContentHash(
  session: { name: string, game: { title: string } },
  document: { title: string, content: string | null, documentUrl: string | null }
) {
  return contentHash([session.game.title, session.name, document.title, document.content || '', document.documentUrl || ''])
}

// Relations visibles du joueur (US-097) : absentes, l'empreinte reste celle d'avant ADR-0050
export type SheetCharacter = { name: string, pitch: string | null, background: string | null, backgroundDocumentUrl: string | null, costumeIndications: string | null, relationLines?: string[] }

export function characterSheetContentHash(session: { name: string }, character: SheetCharacter) {
  return contentHash([session.name, character.name, character.pitch || '', character.background || '', character.backgroundDocumentUrl || '', character.costumeIndications || '', ...(character.relationLines ?? [])])
}
