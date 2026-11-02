import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Pages lisibles hors ligne (revue de la PR #89) : lecture sur l'appareil ou par l'API, relecture au changement de connexion
const state = vi.hoisted(() => ({
  offline: false,
  mounted: [] as Array<() => void>,
  unmounted: [] as Array<() => void>,
  stored: new Map<string, unknown>(),
  saveFails: false
}))

vi.mock('vue', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue')>(),
  onMounted: (callback: () => void) => state.mounted.push(callback),
  onUnmounted: (callback: () => void) => state.unmounted.push(callback)
}))
vi.mock('~/utils/connection', () => ({ isOfflineMode: () => state.offline }))
vi.mock('~/utils/storage', () => ({
  getFromStore: async (store: string, key: string) => state.stored.get(`${store}/${key}`) ?? null,
  saveToStore: async (store: string, key: string, value: unknown) => {
    if (state.saveFails) throw new Error('stockage indisponible')
    state.stored.set(`${store}/${key}`, value)
  }
}))
vi.mock('~/composables/useApiFetch', () => ({ fetchByUrl: vi.fn(async (request: string) => [{ from: request }]) }))

const { fetchOffline, fetchOfflineList, useConnectionRefresh } = await import('~/composables/useOfflineList')

beforeEach(() => {
  state.offline = false
  state.mounted = []
  state.unmounted = []
  state.stored.clear()
  state.saveFails = false
  vi.stubGlobal('window', new EventTarget())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchOffline', () => {
  it('lit par l’API en ligne et garde la réponse sur l’appareil', async () => {
    expect(await fetchOffline('games', 'list', '/api/games')).toEqual([{ from: '/api/games' }])
    expect(state.stored.get('games/list')).toEqual([{ from: '/api/games' }])
  })

  it('lit sur l’appareil hors ligne, null si jamais lue', async () => {
    state.offline = true
    expect(await fetchOffline('dashboard', 'main', '/api/dashboard')).toBeNull()
    state.stored.set('dashboard/main', { sessions: 2 })
    expect(await fetchOffline('dashboard', 'main', '/api/dashboard')).toEqual({ sessions: 2 })
  })

  it('rend la réponse même si l’appareil ne peut pas la garder', async () => {
    state.saveFails = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await fetchOffline('games', 'list', '/api/games')).toEqual([{ from: '/api/games' }])
  })
})

describe('fetchOfflineList', () => {
  it('rend une liste vide hors ligne si la liste n’a jamais été lue', async () => {
    state.offline = true
    expect(await fetchOfflineList('games', '/api/games')).toEqual([])
  })
})

describe('useConnectionRefresh', () => {
  it('relit la page à chaque changement de connexion, pas à l’ouverture', () => {
    const refresh = vi.fn()
    const { isOffline } = useConnectionRefresh(refresh)
    state.offline = true
    state.mounted.forEach((callback) => callback())
    expect(isOffline.value).toBe(true)
    expect(refresh).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('limbus:connection-change'))
    expect(refresh).not.toHaveBeenCalled()

    state.offline = false
    window.dispatchEvent(new Event('online'))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(isOffline.value).toBe(false)

    state.offline = true
    window.dispatchEvent(new Event('offline'))
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('n’écoute plus la connexion une fois la page quittée', () => {
    const refresh = vi.fn()
    useConnectionRefresh(refresh)
    state.mounted.forEach((callback) => callback())
    state.unmounted.forEach((callback) => callback())

    state.offline = true
    window.dispatchEvent(new Event('offline'))
    expect(refresh).not.toHaveBeenCalled()
  })
})
