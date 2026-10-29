import { describe, expect, it } from 'vitest'
import { isInArchivedGame, isVisibleContent } from '~/utils/games'

const actif = { gameId: 'actif', game: { published: true } }
const archive = { gameId: 'archive', game: { published: false } }
const horsLigne = { gameId: 'archive', game: undefined }

describe('contenu d’un jeu archivé (US-013)', () => {
  it('suit l’état de son jeu', () => {
    expect(isInArchivedGame(actif)).toBe(false)
    expect(isInArchivedGame(archive)).toBe(true)
  })

  it('un élément sans jeu en cache (créé hors ligne) reste actif', () => {
    expect(isInArchivedGame(horsLigne)).toBe(false)
    expect(isVisibleContent(horsLigne, '', false)).toBe(true)
  })

  it('est masqué des listes, sauf archives affichées ou jeu choisi', () => {
    expect(isVisibleContent(actif, '', false)).toBe(true)
    expect(isVisibleContent(archive, '', false)).toBe(false)
    expect(isVisibleContent(archive, '', true)).toBe(true)
    expect(isVisibleContent(archive, 'archive', false)).toBe(true)
    expect(isVisibleContent(archive, 'actif', false)).toBe(false)
  })
})
