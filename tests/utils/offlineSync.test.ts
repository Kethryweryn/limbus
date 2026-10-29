import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  abandonOperation,
  conflictFields,
  enqueueOfflineOperation,
  getOfflineQueue,
  heldOperationIds,
  isQueueableApiWrite,
  NO_VERSION,
  operationSummary,
  processOfflineQueue,
  retryOperation
} from '~/utils/offlineSync'

// Magasins IndexedDB de l'appareil, en mémoire
const stores = new Map<string, Map<string, any>>()
const store = (name: string) => stores.get(name) || stores.set(name, new Map()).get(name)!

vi.mock('~/utils/storage', () => ({
  getFromStore: async (name: string, key: string) => structuredClone(store(name).get(key) ?? null),
  saveToStore: async (name: string, key: string, value: unknown) => { store(name).set(key, structuredClone(value)) },
  deleteFromStore: async (name: string, key: string) => { store(name).delete(key) },
  listStoreEntries: async (name: string) => [...store(name).entries()].map(([key, value]) => ({ key, value: structuredClone(value) }))
}))

const fetchMock = vi.fn()

beforeEach(() => {
  stores.clear()
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('navigator', { onLine: true })
})

const READ = '2026-10-30T10:00:00.000Z'
const conflict = () => Object.assign(new Error('409'), { statusCode: 409, data: { message: 'Modifié entre-temps', data: { conflict: true } } })

describe('écritures mises en file hors ligne', () => {
  it('garde les créations et modifications de données', () => {
    expect(isQueueableApiWrite('/api/sessions', { method: 'POST', body: {} })).toBe(true)
    expect(isQueueableApiWrite('/api/sessions/s1', { method: 'PUT', body: {} })).toBe(true)
    expect(isQueueableApiWrite('/api/sessions/s1/timeline', { method: 'PUT', body: {} })).toBe(true)
    expect(isQueueableApiWrite('/api/characters/c1', { method: 'DELETE' })).toBe(true)
  })

  it('n’y met jamais une action comme un envoi d’emails', () => {
    expect(isQueueableApiWrite('/api/sessions/s1/allergies/send', { method: 'POST' })).toBe(false)
    expect(isQueueableApiWrite('/api/sessions/s1/payments/send', { method: 'POST', body: {} })).toBe(false)
    expect(isQueueableApiWrite('/api/games/g1/bequests', { method: 'POST', body: {} })).toBe(false)
    expect(isQueueableApiWrite('/api/games/g1/bequests/i1', { method: 'DELETE' })).toBe(false)
    expect(isQueueableApiWrite('/api/games/g1/shares/u1', { method: 'DELETE' })).toBe(false)
  })
})

describe('cache de l’appareil (US-048)', () => {
  it('une sous-route part en file sans toucher l’élément parent en cache', async () => {
    store('sessions').set('list', [{ id: 's1', name: 'Samedi', updatedAt: READ }])
    const response = await enqueueOfflineOperation('/api/sessions/s1/timeline', { method: 'PUT', body: { assignments: [], updatedAt: READ } })

    expect(store('sessions').get('list')).toEqual([{ id: 's1', name: 'Samedi', updatedAt: READ }])
    expect(response).toMatchObject({ __offlineQueued: true })
    const [operation] = await getOfflineQueue()
    expect(operation).toMatchObject({ entityKey: 'sessions/s1', baseVersion: READ, label: 'Samedi' })
  })

  it('une modification garde la version lue, pas l’heure de l’appareil', async () => {
    store('sessions').set('list', [{ id: 's1', name: 'Samedi', updatedAt: READ }])
    store('responses').set('/api/sessions/samedi', { id: 's1', name: 'Samedi', updatedAt: READ, assignments: [{ characterId: 'c1' }] })
    await enqueueOfflineOperation('/api/sessions/s1', { method: 'PUT', body: { name: 'Dimanche', updatedAt: READ, assignments: [] } })

    expect(store('sessions').get('list')[0]).toMatchObject({ name: 'Dimanche', updatedAt: READ, __offlinePending: true })
    // Page de détail gardée : ses champs simples suivent, ses listes restent dans leur forme
    expect(store('responses').get('/api/sessions/samedi')).toMatchObject({ name: 'Dimanche', updatedAt: READ, assignments: [{ characterId: 'c1' }] })
  })

  it('une suppression porte la version de l’élément en cache', async () => {
    store('factions').set('list', [{ id: 'f1', name: 'Loups', updatedAt: READ }])
    await enqueueOfflineOperation('/api/factions/f1', { method: 'DELETE' })

    const [operation] = await getOfflineQueue()
    expect(operation.headers).toEqual({ 'if-unmodified-since': READ })
    expect(store('factions').get('list')).toEqual([])
  })
})

describe('resynchronisation (US-049, US-050, ADR-0036)', () => {
  it('la seconde modification d’un élément reprend la version laissée par la première', async () => {
    await enqueueOfflineOperation('/api/sessions/s1', { method: 'PUT', body: { name: 'A', updatedAt: READ } })
    await enqueueOfflineOperation('/api/sessions/s1/timeline', { method: 'PUT', body: { assignments: [], updatedAt: READ } })
    fetchMock.mockResolvedValueOnce({ id: 's1', updatedAt: '2026-10-30T12:00:00.000Z' }).mockResolvedValueOnce({ ok: true })

    const { results } = await processOfflineQueue()
    expect(results.every((result) => result.ok)).toBe(true)
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ 'if-unmodified-since': '2026-10-30T12:00:00.000Z' })
  })

  it('un conflit retient les modifications suivantes du même élément, pas celles des autres', async () => {
    await enqueueOfflineOperation('/api/sessions/s1', { method: 'PUT', body: { name: 'Mienne', status: 'scheduled', updatedAt: READ } })
    await enqueueOfflineOperation('/api/sessions/s1/payments/p1', { method: 'PUT', body: { paid: true, updatedAt: NO_VERSION } })
    await enqueueOfflineOperation('/api/factions/f1', { method: 'PUT', body: { name: 'Loups', updatedAt: READ } })
    fetchMock
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce({ id: 's1', name: 'Serveur', status: 'scheduled', updatedAt: '2026-10-30T11:00:00.000Z' })
      .mockResolvedValueOnce({ id: 'f1', updatedAt: '2026-10-30T12:00:00.000Z' })

    const { results } = await processOfflineQueue()
    expect(results.map((result) => [result.ok, Boolean(result.held)])).toEqual([[false, false], [false, true], [true, false]])

    const queue = await getOfflineQueue()
    expect(queue).toHaveLength(2)
    expect(queue[0].status).toBe('conflict')
    expect(heldOperationIds(queue)).toEqual(new Set([queue[1].id]))
    // Seuls les champs qui diffèrent
    expect(conflictFields(queue[0]).map((field) => [field.key, field.mine, field.theirs])).toEqual([['name', 'Mienne', 'Serveur']])
  })

  it('« garder ma version » renvoie la modification sans version', async () => {
    await enqueueOfflineOperation('/api/factions/f1', { method: 'PUT', body: { name: 'Loups', updatedAt: READ } })
    fetchMock.mockRejectedValueOnce(conflict()).mockResolvedValueOnce({ id: 'f1', name: 'Ours' })
    await processOfflineQueue()

    const [operation] = await getOfflineQueue()
    await retryOperation(operation.id, true)
    fetchMock.mockResolvedValueOnce({ id: 'f1', updatedAt: '2026-10-30T12:00:00.000Z' })
    await processOfflineQueue()

    expect(fetchMock.mock.calls.at(-1)?.[1].headers).toBeUndefined()
    expect(await getOfflineQueue()).toEqual([])
  })

  it('abandonner une création abandonne aussi ce qui la suit sur cet élément', async () => {
    const created: any = await enqueueOfflineOperation('/api/factions', { method: 'POST', body: { name: 'Loups' } })
    await enqueueOfflineOperation(`/api/factions/${created.id}`, { method: 'PUT', body: { name: 'Ours' } })
    await enqueueOfflineOperation('/api/items/i1', { method: 'PUT', body: { name: 'Épée', factionId: created.id, updatedAt: READ } })
    await enqueueOfflineOperation('/api/items/i2', { method: 'PUT', body: { name: 'Bouclier', updatedAt: READ } })

    const [creation] = await getOfflineQueue()
    expect(await abandonOperation(creation.id)).toBe(3)
    expect((await getOfflineQueue()).map((operation) => operation.request)).toEqual(['/api/items/i2'])
  })

  it('décrit chaque modification pour le panneau', async () => {
    store('sessions').set('list', [{ id: 's1', name: 'Samedi', updatedAt: READ }])
    await enqueueOfflineOperation('/api/sessions/s1/payments/p1', { method: 'PUT', body: { paid: true, updatedAt: NO_VERSION }, offlineLabel: 'Léa' })
    await enqueueOfflineOperation('/api/sessions/s1', { method: 'DELETE' })

    const [payment, deletion] = await getOfflineQueue()
    expect(operationSummary(payment)).toEqual({ element: 'Session « Samedi »', action: 'Paiement : Léa' })
    expect(operationSummary(deletion)).toEqual({ element: 'Session « Samedi »', action: 'Suppression' })
  })
})
