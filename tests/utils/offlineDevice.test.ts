import { afterEach, describe, expect, it, vi } from 'vitest'
import { isOfflineDisabled, responseSize, serializedSize, setOfflineDisabled } from '~/utils/offlineDevice'

// Réglages du hors ligne propres à l'appareil (SPEC-019, US-223, US-225)
function stubStorage() {
  const stored = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key)
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('isOfflineDisabled', () => {
  it('actif par défaut, désactivé puis réactivé', () => {
    stubStorage()
    expect(isOfflineDisabled()).toBe(false)
    setOfflineDisabled(true)
    expect(isOfflineDisabled()).toBe(true)
    setOfflineDisabled(false)
    expect(isOfflineDisabled()).toBe(false)
  })

  it('un stockage illisible (navigation privée) laisse le hors ligne actif', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('refusé') } })
    expect(isOfflineDisabled()).toBe(false)
  })
})

describe('tailles', () => {
  it('compte les octets du JSON, accents compris', () => {
    expect(serializedSize({ a: 'é' })).toBe(new TextEncoder().encode('{"a":"é"}').length)
    expect(serializedSize(undefined)).toBe(0)
  })

  it('lit la taille d’un fichier dans son en-tête, sans le lire', () => {
    expect(responseSize(new Response('x', { headers: { 'content-length': '2048' } }))).toBe(2048)
    expect(responseSize(new Response('x', { headers: {} }))).toBe(0)
    expect(responseSize(undefined)).toBe(0)
  })
})
