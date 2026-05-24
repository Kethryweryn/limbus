import { getFromStore, saveToStore } from '~/utils/storage'
import { isServerUnavailableError, setServerUnavailable } from '~/utils/connection'

export type OfflineSyncOperation = {
  id: string
  request: string
  method: 'POST' | 'PUT' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  store?: string
  entityId?: string
  createdAt: string
  status: 'pending' | 'syncing' | 'error'
  error?: string
}

const QUEUE_KEY = 'operations'

const STORE_BY_API_PREFIX: Record<string, string> = {
  games: 'games',
  characters: 'characters',
  factions: 'factions',
  intrigues: 'intrigues',
  items: 'items',
  documents: 'documents',
  'timeline-events': 'timelineEvents',
  participants: 'participants',
  locations: 'locations',
  sessions: 'sessions'
}

function normalizedPath(request: string) {
  return request.split('?')[0].replace(/^\/+/, '')
}

function apiResource(request: string) {
  const path = normalizedPath(request)
  const parts = path.split('/')
  return parts[0] === 'api' ? parts[1] : ''
}

function apiEntityId(request: string) {
  const path = normalizedPath(request)
  const parts = path.split('/')
  return parts[0] === 'api' ? parts[2] : ''
}

export function isQueueableApiWrite(request: string, options?: any) {
  const method = String(options?.method || 'GET').toUpperCase()
  const resource = apiResource(request)
  return ['POST', 'PUT', 'DELETE'].includes(method)
    && Boolean(STORE_BY_API_PREFIX[resource])
    && !(options?.body instanceof FormData)
}

export function offlineStoreForRequest(request: string) {
  return STORE_BY_API_PREFIX[apiResource(request)] || ''
}

export async function getOfflineQueue(): Promise<OfflineSyncOperation[]> {
  return await getFromStore('syncQueue', QUEUE_KEY) || []
}

export async function saveOfflineQueue(queue: OfflineSyncOperation[]) {
  await saveToStore('syncQueue', QUEUE_KEY, queue)
  notifyQueueChanged()
}

export async function enqueueOfflineOperation(request: string, options: any = {}) {
  const method = String(options.method || 'GET').toUpperCase() as OfflineSyncOperation['method']
  const store = offlineStoreForRequest(request)
  const body = clone(options.body)
  const entityId = method === 'POST' ? body?.id || tempId() : apiEntityId(request)
  const operation: OfflineSyncOperation = {
    id: tempId(),
    request,
    method,
    body,
    headers: mutationHeaders(body),
    store,
    entityId,
    createdAt: new Date().toISOString(),
    status: 'pending'
  }

  const queue = await getOfflineQueue()
  await saveOfflineQueue([...queue, operation])
  await applyOptimisticCache(operation)
  return optimisticResponse(operation)
}

export async function processOfflineQueue() {
  let queue = await getOfflineQueue()
  const results: Array<{ id: string, ok: boolean, error?: string }> = []

  for (const operation of queue) {
    if (!navigator.onLine) {
      setServerUnavailable(true)
      return { results, aborted: true }
    }

    if (operation.status === 'error') {
      results.push({ id: operation.id, ok: false, error: operation.error })
      continue
    }

    await markOperation(operation.id, { status: 'syncing', error: undefined })

    try {
      const response: any = await $fetch(operation.request, {
        method: operation.method,
        body: operation.body,
        headers: operation.headers
      })
      queue = (await getOfflineQueue()).filter((item) => item.id !== operation.id)
      if (operation.method === 'POST' && operation.entityId && response?.id && response.id !== operation.entityId) {
        queue = queue.map((item) => remapTemporaryEntity(item, operation.entityId!, response.id))
      }
      await saveOfflineQueue(queue)
      results.push({ id: operation.id, ok: true })
    } catch (error: any) {
      if (isServerUnavailableError(error) || !navigator.onLine) {
        await markOperation(operation.id, { status: 'pending', error: undefined })
        setServerUnavailable(true)
        return { results, aborted: true }
      }

      const message = error?.data?.message || error?.message || 'Erreur de synchronisation'
      await markOperation(operation.id, { status: 'error', error: message })
      results.push({ id: operation.id, ok: false, error: message })
    }
  }

  notifyQueueChanged()
  return { results, aborted: false }
}

export function notifyQueueChanged() {
  if (!process.client) return
  window.dispatchEvent(new CustomEvent('limbus:sync-queue-change'))
}

async function markOperation(id: string, patch: Partial<OfflineSyncOperation>) {
  const queue = await getOfflineQueue()
  await saveOfflineQueue(queue.map((operation) => operation.id === id ? { ...operation, ...patch } : operation))
}

async function applyOptimisticCache(operation: OfflineSyncOperation) {
  if (!operation.store) return

  const current = await getFromStore<any[]>(operation.store, 'list') || []
  if (operation.method === 'DELETE') {
    await saveToStore(operation.store, 'list', current.filter((item) => item.id !== operation.entityId))
    return
  }

  const now = new Date().toISOString()
  const entity = {
    ...(operation.body || {}),
    id: operation.entityId,
    updatedAt: now,
    createdAt: operation.body?.createdAt || now,
    __offlinePending: true
  }

  if (operation.method === 'POST') {
    await saveToStore(operation.store, 'list', [entity, ...current])
    return
  }

  await saveToStore(operation.store, 'list', current.map((item) =>
    item.id === operation.entityId ? { ...item, ...entity } : item
  ))
}

function optimisticResponse(operation: OfflineSyncOperation) {
  if (operation.method === 'DELETE') return { success: true, __offlineQueued: true }
  return {
    ...(operation.body || {}),
    id: operation.entityId,
    __offlineQueued: true,
    __offlinePending: true
  }
}

function mutationHeaders(body: any) {
  if (!body?.updatedAt) return undefined
  return { 'if-unmodified-since': new Date(body.updatedAt).toISOString() }
}

function tempId() {
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function clone<T>(value: T): T {
  if (!value) return value
  return JSON.parse(JSON.stringify(value))
}

function remapTemporaryEntity(operation: OfflineSyncOperation, temporaryId: string, realId: string) {
  const request = operation.request.replace(`/${temporaryId}`, `/${realId}`)
  return {
    ...operation,
    request,
    entityId: operation.entityId === temporaryId ? realId : operation.entityId,
    body: replaceDeep(operation.body, temporaryId, realId)
  }
}

function replaceDeep(value: any, from: string, to: string): any {
  if (value === from) return to
  if (Array.isArray(value)) return value.map((item) => replaceDeep(item, from, to))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceDeep(item, from, to)]))
  }
  return value
}
