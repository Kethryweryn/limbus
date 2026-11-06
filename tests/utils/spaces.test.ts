import { describe, expect, it, vi } from 'vitest'
import { initialSpace, rememberSpace, showsSpaceSelector, spaceOfPath } from '~/utils/spaces'

// Sélecteur d'espace (US-073)
describe('spaceOfPath', () => {
  it.each([['/participer', 'participate'], ['/participer/inscriptions/x', 'participate'], ['/', 'organize'], ['/participerx', 'organize'], ['/games', 'organize']])('%s → %s', (path, space) => {
    expect(spaceOfPath(path)).toBe(space)
  })
})

describe('initialSpace', () => {
  it('rouvre le dernier espace utilisé', () => {
    expect(initialSpace({ organize: true, participate: true }, 'u1', 'participate')).toBe('participate')
    expect(initialSpace({ organize: false, participate: true }, 'u1', 'organize')).toBe('organize')
  })

  it('la première fois : « J’organise » avec un jeu à organiser, sinon « Je participe »', () => {
    expect(initialSpace({ organize: true, participate: true }, 'u1', null)).toBe('organize')
    expect(initialSpace({ organize: false, participate: true }, 'u1', null)).toBe('participate')
    expect(initialSpace({ organize: false, participate: false }, 'u1', null)).toBe('participate')
  })

  it('n’applique pas le choix d’un autre compte du même appareil, ni l’ancien format', () => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value)
    })
    rememberSpace('organize', 'autre-compte')
    expect(initialSpace({ organize: false, participate: true }, 'u1')).toBe('participate')
    expect(initialSpace({ organize: false, participate: true }, 'autre-compte')).toBe('organize')

    stored.set('limbusSpace', 'organize')
    expect(initialSpace({ organize: false, participate: true }, 'u1')).toBe('participate')
    vi.unstubAllGlobals()
  })
})

describe('showsSpaceSelector', () => {
  it('apparaît pour qui organise et participe', () => {
    expect(showsSpaceSelector({ organize: true, participate: true }, 'organize')).toBe(true)
    expect(showsSpaceSelector({ organize: true, participate: true }, 'participate')).toBe(true)
  })

  it('reste caché pour qui ne fait que participer, sauf côté organisation, pour pouvoir revenir', () => {
    expect(showsSpaceSelector({ organize: false, participate: true }, 'participate')).toBe(false)
    expect(showsSpaceSelector({ organize: false, participate: true }, 'organize')).toBe(true)
  })

  it('reste caché sans fiche participant', () => {
    expect(showsSpaceSelector({ organize: true, participate: false }, 'organize')).toBe(false)
    expect(showsSpaceSelector(undefined, 'organize')).toBe(false)
  })
})
