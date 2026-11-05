// Assemble les notes de `nouveautes/` au build (SPEC-017, ADR-0065)
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { RELEASE_NOTE_TYPES, type ReleaseNotesData } from '../../utils/releaseNotes'

export const NOTES_DIR = 'nouveautes'

const noteSchema = z.strictObject({
  type: z.enum(RELEASE_NOTE_TYPES),
  titre: z.string().trim().min(1).max(120),
  texte: z.string().trim().min(1).max(600)
})

export function readNoteFiles(rootDir: string) {
  return readdirSync(join(rootDir, NOTES_DIR))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      try {
        return { file, ...noteSchema.parse(JSON.parse(readFileSync(join(rootDir, NOTES_DIR, file), 'utf8'))) }
      } catch (error) {
        throw new Error(`Note invalide : ${NOTES_DIR}/${file}`, { cause: error })
      }
    })
}

function git(repo: string, ...args: string[]) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()
}

/** Moment du commit qui a ajouté chaque note ; le plus récent si une note a été supprimée puis remise. */
export function noteDates(repo: string) {
  // Un dépôt tronqué ferait passer toutes les notes pour ajoutées par son plus ancien commit
  if (git(repo, 'rev-parse', '--is-shallow-repository') === 'true') {
    throw new Error(`Historique git tronqué dans ${repo} : les dates des notes seraient fausses`)
  }
  const dates = new Map<string, string>()
  let current = ''
  for (const line of git(repo, 'log', '--diff-filter=A', '--name-only', '--format=%cI', '--', `${NOTES_DIR}/`).split('\n')) {
    if (line.startsWith(`${NOTES_DIR}/`)) {
      const file = line.slice(NOTES_DIR.length + 1)
      if (!dates.has(file)) dates.set(file, current)
    } else if (line) {
      current = line
    }
  }
  return dates
}

/** Numéro donné par la CI, sinon celui du titre du dernier commit : « Titre (#141) ». */
export function deployNumberOf(repo: string, prNumber?: string) {
  const match = prNumber?.match(/^\d+$/) ?? git(repo, 'log', '-1', '--format=%s').match(/\(#(\d+)\)$/)
  if (!match) return null
  return Number(match[1] ?? match[0])
}

/**
 * Sans dépôt indiqué (poste de développement, conteneur de test), les notes prennent le jour du build et le numéro
 * n'existe pas. Avec un dépôt (CI, deploy.sh), tout écart échoue : jamais de fausse date en production.
 */
export function buildReleaseNotes({ rootDir, repo, prNumber, now = new Date() }: {
  rootDir: string
  repo?: string
  prNumber?: string
  now?: Date
}): ReleaseNotesData {
  const files = readNoteFiles(rootDir)
  const dates = repo ? noteDates(repo) : null
  const notes = files.map(({ file, ...note }) => {
    const at = dates ? dates.get(file) : now.toISOString()
    if (!at) throw new Error(`Note absente de l'historique git : ${NOTES_DIR}/${file}`)
    return { ...note, at }
  })
  return {
    notes: notes.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    deployNumber: repo ? deployNumberOf(repo, prNumber) : null
  }
}
