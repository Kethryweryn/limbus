import { describe, expect, it } from 'vitest'
import { initialSpace, spaceOfPath } from '~/utils/spaces'

// Sélecteur d'espace (US-073)
describe('spaceOfPath', () => {
  it.each([['/participer', 'participate'], ['/participer/inscriptions/x', 'participate'], ['/', 'organize'], ['/participerx', 'organize'], ['/games', 'organize']])('%s → %s', (path, space) => {
    expect(spaceOfPath(path)).toBe(space)
  })
})

describe('initialSpace', () => {
  it('rouvre le dernier espace utilisé', () => {
    expect(initialSpace({ organize: true, participate: true }, 'participate')).toBe('participate')
    expect(initialSpace({ organize: false, participate: true }, 'organize')).toBe('organize')
  })

  it('la première fois : « J’organise » avec un jeu à organiser, sinon « Je participe »', () => {
    expect(initialSpace({ organize: true, participate: true }, null)).toBe('organize')
    expect(initialSpace({ organize: false, participate: true }, null)).toBe('participate')
    expect(initialSpace({ organize: false, participate: false }, null)).toBe('participate')
  })
})
