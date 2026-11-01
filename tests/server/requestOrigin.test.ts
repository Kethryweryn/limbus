import { describe, expect, it } from 'vitest'
import { isCheckedWrite, isSameOriginWrite } from '~/server/utils/requestOrigin'

const app = 'https://limbuslarp.fr'

// US-104 : origine des écritures
describe('écritures vérifiées', () => {
  it('ne concerne que les écritures sous /api/, sauf les rapports CSP', () => {
    expect(isCheckedWrite('POST', '/api/auth/login')).toBe(true)
    expect(isCheckedWrite('delete', '/api/games/1?x=1')).toBe(true)
    expect(isCheckedWrite('GET', '/api/games')).toBe(false)
    expect(isCheckedWrite('POST', '/inscription/abc')).toBe(false)
    expect(isCheckedWrite('POST', '/api/public/csp-report')).toBe(false)
  })
})

describe('origine d’une écriture', () => {
  it('suit Sec-Fetch-Site quand le navigateur l’envoie', () => {
    expect(isSameOriginWrite({ secFetchSite: 'same-origin' }, app)).toBe(true)
    expect(isSameOriginWrite({ secFetchSite: 'none' }, app)).toBe(true)
    expect(isSameOriginWrite({ secFetchSite: 'cross-site', origin: app }, app)).toBe(false)
    expect(isSameOriginWrite({ secFetchSite: 'same-site' }, app)).toBe(false)
  })

  it('compare sinon Origin, puis Referer, à l’origine de l’application', () => {
    expect(isSameOriginWrite({ origin: app }, app)).toBe(true)
    expect(isSameOriginWrite({ origin: 'https://evil.example' }, app)).toBe(false)
    expect(isSameOriginWrite({ origin: 'null', referer: `${app}/games` }, app)).toBe(true)
    expect(isSameOriginWrite({ referer: 'https://limbuslarp.fr.evil.example/' }, app)).toBe(false)
  })

  it('refuse une écriture sans aucun indice d’origine', () => {
    expect(isSameOriginWrite({}, app)).toBe(false)
    expect(isSameOriginWrite({ referer: 'pas une url' }, app)).toBe(false)
  })
})
