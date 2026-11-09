// US-212 : une réponse identique à la dernière gardée n'est pas réécrite sur l'appareil, sauf après une écriture faite
// par la file hors ligne ou un effacement de l'appareil
import { beforeEach, describe, expect, it, vi } from 'vitest'

const writes: Array<[string, string]> = []
vi.mock('idb', () => ({
  openDB: async () => ({
    transaction: (store: string) => ({ store: { put: async (_value: unknown, key: string) => { writes.push([store, key]) } }, done: Promise.resolve() }),
    close: () => {}
  }),
  deleteDB: async () => {}
}))

const { forgetSavedResponse, saveCachedResponse } = await import('~/utils/storage')

beforeEach(() => { writes.length = 0 })

describe('réponses gardées sur l’appareil', () => {
  it('ne réécrit pas une réponse identique, mais réécrit une réponse changée', async () => {
    await saveCachedResponse('/api/games', [{ id: 'a' }])
    await saveCachedResponse('/api/games', [{ id: 'a' }])
    expect(writes).toHaveLength(1)
    await saveCachedResponse('/api/games', [{ id: 'b' }])
    expect(writes).toHaveLength(2)
  })

  it('réécrit après une écriture de la file hors ligne', async () => {
    await saveCachedResponse('/api/items/slug/x', { id: 'x' })
    forgetSavedResponse('/api/items/slug/x')
    await saveCachedResponse('/api/items/slug/x', { id: 'x' })
    expect(writes.filter(([, key]) => key === '/api/items/slug/x')).toHaveLength(2)
  })
})
