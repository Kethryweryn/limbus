// @vitest-environment node
// US-147, US-148 : assemblage des notes de la page « Nouveautés »
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildReleaseNotes, readNoteFiles } from '../../modules/releaseNotes/notes'

const note = { type: 'nouveau', titre: 'Titre', texte: 'Texte' }
const folders: string[] = []

function emptyFolder() {
  const folder = mkdtempSync(join(tmpdir(), 'limbus-notes-'))
  folders.push(folder)
  mkdirSync(join(folder, 'nouveautes'))
  return folder
}

function writeNote(folder: string, name: string, content: unknown = note) {
  writeFileSync(join(folder, 'nouveautes', name), JSON.stringify(content))
}

function git(folder: string, args: string[], date?: string) {
  return execFileSync('git', ['-C', folder, '-c', 'user.name=Test', '-c', 'user.email=test@example.test', ...args], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, ...(date ? { GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date } : {}) }
  })
}

function repository() {
  const folder = emptyFolder()
  git(folder, ['init', '-q'])
  return folder
}

function commitNote(folder: string, name: string, date: string, title = `Ajout de ${name}`) {
  writeNote(folder, name, { ...note, titre: name })
  git(folder, ['add', '.'])
  git(folder, ['commit', '-q', '-m', title], date)
}

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

describe('notes du dépôt', () => {
  it('sont toutes valides', () => {
    expect(readNoteFiles(process.cwd()).length).toBeGreaterThan(0)
  })
})

describe('readNoteFiles', () => {
  it.each([
    ['un type inconnu', { ...note, type: 'autre' }],
    ['un titre vide', { ...note, titre: ' ' }],
    ['un champ en trop', { ...note, date: '2026-11-05' }]
  ])('refuse %s en nommant le fichier', (_case, content) => {
    const folder = emptyFolder()
    writeNote(folder, 'mauvaise.json', content)
    expect(() => readNoteFiles(folder)).toThrow('nouveautes/mauvaise.json')
  })

  it('refuse un JSON illisible en nommant le fichier', () => {
    const folder = emptyFolder()
    writeFileSync(join(folder, 'nouveautes', 'cassee.json'), '{')
    expect(() => readNoteFiles(folder)).toThrow('nouveautes/cassee.json')
  })
})

describe('buildReleaseNotes', () => {
  it('sans dépôt, date les notes du jour du build et ne donne aucun numéro', () => {
    const folder = emptyFolder()
    writeNote(folder, 'a.json')
    const now = new Date('2026-11-05T10:00:00Z')
    expect(buildReleaseNotes({ rootDir: folder, prNumber: '141', now })).toEqual({
      notes: [{ ...note, at: now.toISOString() }],
      deployNumber: null
    })
  })

  it('date chaque note du commit qui l’a ajoutée, et classe la plus récente d’abord, le même jour compris', () => {
    const folder = repository()
    commitNote(folder, 'ancienne.json', '2026-11-03T09:00:00+01:00')
    commitNote(folder, 'matin.json', '2026-11-05T09:00:00+01:00')
    commitNote(folder, 'soir.json', '2026-11-05T18:00:00+01:00')
    // Une correction ultérieure de la note ne change pas sa date
    writeNote(folder, 'ancienne.json', { ...note, titre: 'ancienne corrigée' })
    git(folder, ['commit', '-q', '-am', 'Correction'], '2026-11-06T09:00:00+01:00')

    const { notes } = buildReleaseNotes({ rootDir: folder, repo: folder })
    expect(notes.map(({ titre, at }) => [titre, at])).toEqual([
      ['soir.json', '2026-11-05T18:00:00+01:00'],
      ['matin.json', '2026-11-05T09:00:00+01:00'],
      ['ancienne corrigée', '2026-11-03T09:00:00+01:00']
    ])
  })

  it('retrouve une note au nom accentué, et date une note renommée de son renommage', () => {
    const folder = repository()
    commitNote(folder, 'écran.json', '2026-11-03T09:00:00+01:00')
    commitNote(folder, 'avant.json', '2026-11-04T09:00:00+01:00')
    git(folder, ['mv', 'nouveautes/avant.json', 'nouveautes/apres.json'])
    git(folder, ['commit', '-q', '-m', 'Renommage'], '2026-11-05T09:00:00+01:00')

    const { notes } = buildReleaseNotes({ rootDir: folder, repo: folder })
    expect(notes.map(({ titre, at }) => [titre, at])).toEqual([
      ['avant.json', '2026-11-05T09:00:00+01:00'],
      ['écran.json', '2026-11-03T09:00:00+01:00']
    ])
  })

  it('refuse une note absente de l’historique', () => {
    const folder = repository()
    commitNote(folder, 'suivie.json', '2026-11-05T09:00:00+01:00')
    writeNote(folder, 'oubliee.json')
    expect(() => buildReleaseNotes({ rootDir: folder, repo: folder })).toThrow('nouveautes/oubliee.json')
  })

  it('refuse un dépôt absent ou à l’historique tronqué', () => {
    const plain = emptyFolder()
    writeNote(plain, 'a.json')
    expect(() => buildReleaseNotes({ rootDir: plain, repo: join(plain, 'absent') })).toThrow()

    const source = repository()
    commitNote(source, 'a.json', '2026-11-03T09:00:00+01:00')
    commitNote(source, 'b.json', '2026-11-05T09:00:00+01:00')
    const shallow = emptyFolder()
    rmSync(shallow, { recursive: true })
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${source}`, shallow], { stdio: 'pipe' })
    expect(() => buildReleaseNotes({ rootDir: shallow, repo: shallow })).toThrow('tronqué')
  })

  it('prend le numéro donné par la CI, sinon celui du titre du commit, sinon aucun', () => {
    const folder = repository()
    commitNote(folder, 'a.json', '2026-11-05T09:00:00+01:00', 'Une fonctionnalité (#141)')
    expect(buildReleaseNotes({ rootDir: folder, repo: folder, prNumber: '150' }).deployNumber).toBe(150)
    expect(buildReleaseNotes({ rootDir: folder, repo: folder, prNumber: '' }).deployNumber).toBe(141)

    commitNote(folder, 'b.json', '2026-11-05T10:00:00+01:00', 'Sans numéro')
    expect(buildReleaseNotes({ rootDir: folder, repo: folder }).deployNumber).toBeNull()
  })
})
