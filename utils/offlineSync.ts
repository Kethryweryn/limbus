import { deleteFromStore, getFromStore, listStoreEntries, saveToStore } from '~/utils/storage'
import { getErrorStatus, isServerUnavailableError, setServerUnavailable } from '~/utils/connection'

export type OfflineSyncOperation = {
  id: string
  request: string
  method: 'POST' | 'PUT' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  store?: string
  entityId?: string
  // Élément touché (ressource et identifiant, sous-routes comprises) : une modification en erreur retient
  // les suivantes du même élément (ADR-0036)
  entityKey?: string
  // Version lue, envoyée dans If-Unmodified-Since ; « garder ma version » renvoie sans elle (force)
  baseVersion?: string
  force?: boolean
  // Nom de l'élément et précision (personne d'un paiement, tarif…), pour le panneau des modifications
  label?: string
  detail?: string
  createdAt: string
  status: 'pending' | 'syncing' | 'error' | 'conflict'
  error?: string
  // Version du serveur relue lors d'un conflit, pour la comparaison champ par champ
  serverVersion?: any
}

export type OfflineSyncResult = { id: string, ok: boolean, held?: boolean, error?: string }

const QUEUE_KEY = 'operations'
// Version d'une ligne pas encore créée (paiement, réglages, trombinoscope) : toute ligne créée depuis est plus récente
export const NO_VERSION = new Date(0).toISOString()
const TEMPORARY_ID_PREFIX = 'offline-'

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

const RESOURCE_LABELS: Record<string, string> = {
  games: 'Jeu',
  characters: 'Personnage',
  factions: 'Groupe',
  intrigues: 'Intrigue',
  items: 'Objet',
  documents: 'Document',
  'timeline-events': 'Événement',
  participants: 'Participant',
  locations: 'Lieu',
  sessions: 'Session'
}

function normalizedPath(request: string) {
  return (request.split('?')[0] || '').replace(/^\/+/, '')
}

// [ressource, identifiant, ...sous-route] d'une URL d'API
function apiSegments(request: string) {
  const parts = normalizedPath(request).split('/')
  return parts[0] === 'api' ? parts.slice(1) : []
}

function isSubRoute(request: string) {
  return apiSegments(request).length > 2
}

// Un POST sur une sous-route (/api/sessions/:id/payments/send…) est une action, souvent un envoi d'emails :
// rejouée plus tard sans confirmation, elle partirait avec des données périmées. De même pour un DELETE sur
// une sous-route (/api/games/:id/bequests/:invitationId…) : il ne supprime pas la ressource elle-même.
// Seules les créations (/api/<ressource>) et les modifications (PUT, DELETE /api/<ressource>/:id) sont mises en file.
function isActionRequest(request: string, method: string) {
  const segments = normalizedPath(request).split('/').length
  return (method === 'POST' && segments > 2) || (method === 'DELETE' && segments > 3)
}

export function isQueueableApiWrite(request: string, options?: any) {
  const method = String(options?.method || 'GET').toUpperCase()
  const [resource = ''] = apiSegments(request)
  return ['POST', 'PUT', 'DELETE'].includes(method)
    && Boolean(STORE_BY_API_PREFIX[resource])
    && !isActionRequest(request, method)
    && !(options?.body instanceof FormData)
}

export function offlineStoreForRequest(request: string) {
  return STORE_BY_API_PREFIX[apiSegments(request)[0] || ''] || ''
}

// Élément d'une modification : la session pour son déroulé ou ses paiements (ADR-0036)
export function operationEntityKey(operation: Pick<OfflineSyncOperation, 'request' | 'entityId' | 'entityKey'>) {
  if (operation.entityKey) return operation.entityKey
  const [resource, id] = apiSegments(operation.request)
  return `${resource}/${id || operation.entityId || ''}`
}

// Ce dont la version est lue : la session pour son déroulé (ADR-0028), la ligne de paiement d'une personne,
// les réglages de paiement, un tarif, le trombinoscope d'un personnage (ADR-0036)
function versionKeyOf(request: string) {
  const [resource, id, ...rest] = apiSegments(request)
  if (!rest.length || rest.join('/') === 'timeline') return `${resource}/${id}`
  if (rest[0] === 'payments' && rest[1] !== 'settings') return `${resource}/${id}/payments/${rest[1]}`
  return [resource, id, ...rest].join('/')
}

function isTemporaryId(id?: string) {
  return Boolean(id?.startsWith(TEMPORARY_ID_PREFIX))
}

function versionOf(value: unknown) {
  if (!value) return undefined
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
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
  const [, id] = apiSegments(request)
  const entityId = method === 'POST' ? body?.id || tempId() : id
  const cached = entityId ? await findCachedEntity(store, entityId) : null
  // Version lue (ADR-0036) : celle du corps, ou pour une suppression celle de l'élément en cache. Un élément
  // créé hors ligne n'en a pas : personne d'autre n'a pu le modifier
  const baseVersion = method === 'POST' || isTemporaryId(entityId)
    ? undefined
    : versionOf(options.headers?.['if-unmodified-since']) || versionOf(body?.updatedAt) || (method === 'DELETE' ? versionOf(cached?.updatedAt) : undefined)
  const subRoute = isSubRoute(request)
  const operation: OfflineSyncOperation = {
    id: tempId(),
    request,
    method,
    body,
    headers: baseVersion ? { 'if-unmodified-since': baseVersion } : undefined,
    store,
    entityId,
    entityKey: operationEntityKey({ request, entityId }),
    baseVersion,
    label: (subRoute ? entityName(cached) : entityName(body) || entityName(cached)) || '',
    detail: options.offlineLabel || (subRoute ? entityName(body) : '') || undefined,
    createdAt: new Date().toISOString(),
    status: 'pending'
  }

  const queue = await getOfflineQueue()
  await saveOfflineQueue([...queue, operation])
  await applyOptimisticCache(operation)
  if (import.meta.client) window.dispatchEvent(new CustomEvent('limbus:offline-queued'))
  return optimisticResponse(operation, cached)
}

// Modifications retenues : une modification précédente du même élément, ou la création hors ligne d'un
// élément qu'elles citent, est en erreur (ADR-0036)
export function heldOperationIds(queue: OfflineSyncOperation[]) {
  const held = new Set<string>()
  const blockedKeys = new Set<string>()
  const blockedTemporaryIds = new Set<string>()
  for (const operation of queue) {
    if (operation.status === 'error' || operation.status === 'conflict') {
      blockedKeys.add(operationEntityKey(operation))
      if (operation.method === 'POST' && operation.entityId) blockedTemporaryIds.add(operation.entityId)
      continue
    }
    if (blockedKeys.has(operationEntityKey(operation)) || [...blockedTemporaryIds].some((temporaryId) => references(operation, temporaryId))) {
      held.add(operation.id)
    }
  }
  return held
}

export async function processOfflineQueue() {
  const results: OfflineSyncResult[] = []
  const ids = (await getOfflineQueue()).map((operation) => operation.id)

  for (const id of ids) {
    // La file change à chaque envoi (identifiants provisoires remplacés, versions reprises) : on la relit
    const queue = await getOfflineQueue()
    const operation = queue.find((item) => item.id === id)
    if (!operation) continue

    if (!navigator.onLine) {
      setServerUnavailable(true)
      return { results, aborted: true }
    }

    if (operation.status === 'error' || operation.status === 'conflict') {
      results.push({ id, ok: false, error: operation.error })
      continue
    }
    if (heldOperationIds(queue).has(id)) {
      results.push({ id, ok: false, held: true })
      continue
    }

    await markOperation(id, { status: 'syncing', error: undefined })

    try {
      const response: any = await $fetch(operation.request, {
        method: operation.method,
        body: operation.body,
        headers: operation.force ? undefined : operation.headers
      })
      let next = (await getOfflineQueue()).filter((item) => item.id !== id)
      if (operation.method === 'POST' && operation.entityId && response?.id && response.id !== operation.entityId) {
        next = next.map((item) => remapTemporaryEntity(item, operation.entityId!, response.id))
      }
      const newVersion = versionOf(response?.updatedAt)
      if (newVersion) next = next.map((item) => chainVersion(item, operation, newVersion))
      await saveOfflineQueue(next)
      results.push({ id, ok: true })
    } catch (error: any) {
      if (isServerUnavailableError(error) || !navigator.onLine) {
        await markOperation(id, { status: 'pending', error: undefined })
        setServerUnavailable(true)
        return { results, aborted: true }
      }

      const message = error?.data?.message || error?.message || 'Erreur de synchronisation'
      if (isConflictError(error)) {
        const serverVersion = await fetchServerVersion(operation).catch(() => undefined)
        await markOperation(id, { status: 'conflict', error: message, serverVersion })
      } else {
        await markOperation(id, { status: 'error', error: message })
      }
      results.push({ id, ok: false, error: message })
    }
  }

  notifyQueueChanged()
  return { results, aborted: false }
}

// Abandonner une modification ; abandonner une création abandonne aussi ce qui la suit sur cet élément
export async function abandonOperation(id: string) {
  const queue = await getOfflineQueue()
  const operation = queue.find((item) => item.id === id)
  if (!operation) return 0

  const removed = new Set([id])
  if (operation.method === 'POST' && operation.entityId) {
    for (const item of queue) {
      if (operationEntityKey(item) === operationEntityKey(operation) || references(item, operation.entityId)) removed.add(item.id)
    }
  }
  await saveOfflineQueue(queue.filter((item) => !removed.has(item.id)))
  return removed.size
}

export async function abandonAllOperations() {
  await saveOfflineQueue([])
}

// Renvoyer une modification en échec ; avec force, sans version : elle remplace celle du serveur
export async function retryOperation(id: string, force = false) {
  const queue = await getOfflineQueue()
  await saveOfflineQueue(queue.map((operation) => operation.id === id
    ? { ...operation, status: 'pending', error: undefined, serverVersion: undefined, force: force || operation.force }
    : operation))
}

export function notifyQueueChanged() {
  if (!import.meta.client) return
  window.dispatchEvent(new CustomEvent('limbus:sync-queue-change'))
}

export function operationSummary(operation: OfflineSyncOperation) {
  const [resource = '', , ...rest] = apiSegments(operation.request)
  const element = `${RESOURCE_LABELS[resource] || 'Élément'}${operation.label ? ` « ${operation.label} »` : ''}`
  const action = operation.method === 'POST'
    ? 'Création'
    : operation.method === 'DELETE'
      ? 'Suppression'
      : rest.length ? subRouteLabel(rest) : 'Modification'
  return { element, action: operation.detail ? `${action} : ${operation.detail}` : action }
}

function subRouteLabel(rest: string[]) {
  if (rest[0] === 'timeline') return 'Déroulé'
  if (rest[0] === 'trombinoscope') return 'Trombinoscope'
  if (rest[0] === 'tariffs') return 'Tarif'
  if (rest[0] === 'payments') {
    if (rest[1] === 'settings') return 'Réglages de paiement'
    const labels: Record<string, string> = { departure: 'Départ', offered: 'Place offerte', refund: 'Remboursement', tariff: 'Tarif d’une personne' }
    return labels[rest[2] || ''] || 'Paiement'
  }
  return 'Modification'
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom',
  title: 'Titre',
  description: 'Description',
  pitch: 'Pitch',
  date: 'Date',
  status: 'Statut',
  published: 'Publiée',
  locationId: 'Lieu',
  gameId: 'Jeu',
  participants: 'Équipe',
  assignments: 'Affectations',
  entries: 'Entrées du trombinoscope',
  paid: 'Payé',
  offered: 'Place offerte',
  tariffId: 'Tarif',
  transferToParticipantId: 'Remplaçant',
  amount: 'Montant',
  defaultRole: 'Rôle par défaut',
  baseTariffId: 'Tarif de base',
  paymentRibUrl: 'RIB',
  paymentLinkUrl: 'Lien de paiement',
  withdrawalDeadline: 'Date limite de désistement',
  email: 'Email',
  phone: 'Téléphone',
  notes: 'Notes',
  gameNotes: 'Notes'
}
const IGNORED_FIELDS = new Set(['id', 'updatedAt', 'createdAt', 'paidAt', 'slug', '__offlinePending', '__offlineQueued'])

// Champs qui diffèrent entre ma version et celle du serveur (US-050) : seuls ceux que le serveur connaît
export function conflictFields(operation: OfflineSyncOperation) {
  const server = operation.serverVersion
  if (!server || !operation.body || typeof operation.body !== 'object') return []

  return Object.keys(operation.body)
    .filter((key) => !IGNORED_FIELDS.has(key) && key in server)
    .map((key) => ({ key, label: FIELD_LABELS[key] || key, mine: operation.body[key], theirs: server[key] }))
    .filter((field) => comparable(field.mine, field.mine) !== comparable(field.theirs, field.mine))
}

// Valeur comparable, ramenée à la forme de ma version : mêmes clés pour les objets, ordre indifférent
// pour les listes, date à la minute, vide = null
function comparable(value: any, shape: any): string {
  return JSON.stringify(normalizeLike(value, shape))
}

function normalizeLike(value: any, shape: any): any {
  if (value === undefined || value === '' || value === null) return null
  if (Array.isArray(value)) {
    const itemShape = Array.isArray(shape) ? shape[0] : undefined
    return value.map((item) => normalizeLike(item, itemShape)).map((item) => JSON.stringify(item)).sort()
  }
  if (typeof value === 'object') {
    const keys = shape && typeof shape === 'object' && !Array.isArray(shape) ? Object.keys(shape) : Object.keys(value)
    return Object.fromEntries(keys.filter((key) => !IGNORED_FIELDS.has(key)).sort().map((key) => [key, normalizeLike(value[key], shape?.[key])]))
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 16)
  }
  return value
}

function isConflictError(error: any) {
  return getErrorStatus(error) === 409 && Boolean(error?.data?.data?.conflict)
}

// Version actuelle du serveur, ramenée aux champs que la modification envoie
async function fetchServerVersion(operation: OfflineSyncOperation): Promise<any> {
  const [resource, id, ...rest] = apiSegments(operation.request)
  const base = `/api/${resource}/${id}`
  if (!rest.length) return await $fetch(base)

  if (rest[0] === 'timeline') {
    const timeline: any = await $fetch(`${base}/timeline`)
    return {
      assignments: (timeline.events || [])
        .filter((event: any) => event.responsibles?.length)
        .map((event: any) => ({ timelineEventId: event.id, participantIds: event.responsibles.map((responsible: any) => responsible.participantId) }))
    }
  }

  if (rest[0] === 'trombinoscope') {
    const config: any = await $fetch(`${base}/trombinoscope`)
    return {
      entries: (config.characters || []).map((target: any) => ({
        targetCharacterId: target.id,
        included: Boolean(target.trombinoscope?.included),
        faceKnown: Boolean(target.trombinoscope?.faceKnown),
        displayName: target.trombinoscope?.displayName || target.name,
        note: target.trombinoscope?.note || ''
      }))
    }
  }

  if (rest[0] === 'payments' || rest[0] === 'tariffs') {
    const dashboard: any = await $fetch(`${base}/payments`)
    if (rest[0] === 'tariffs') {
      const tariff = (dashboard.tariffs || []).find((item: any) => item.id === rest[1])
      return tariff && { ...tariff, amount: tariff.amountCents / 100 }
    }
    if (rest[1] === 'settings') return dashboard.session

    const row = [...(dashboard.rows || []), ...(dashboard.unassignedPayments || []), ...(dashboard.refunds || [])]
      .find((item: any) => item.participant?.id === rest[1])
    return row && {
      paid: Boolean(row.paidAt),
      offered: Boolean(row.offered),
      tariffId: row.tariffChosen ? row.tariff?.id ?? null : null,
      status: row.refundStatus ?? null,
      transferToParticipantId: row.transferredTo?.id ?? null
    }
  }

  return undefined
}

async function markOperation(id: string, patch: Partial<OfflineSyncOperation>) {
  const queue = await getOfflineQueue()
  await saveOfflineQueue(queue.map((operation) => operation.id === id ? { ...operation, ...patch } : operation))
}

async function findCachedEntity(store: string, id: string) {
  const list = store ? await getFromStore<any[]>(store, 'list') : null
  const fromList = Array.isArray(list) ? list.find((item) => item?.id === id) : null
  if (fromList) return fromList
  const responses = await listStoreEntries('responses')
  return responses.find((entry) => entry.value?.id === id)?.value || null
}

function entityName(value: any) {
  return value?.name || value?.title || ''
}

// Le cache de l'appareil reflète aussitôt la modification. Seules les écritures sur l'élément lui-même le
// touchent : une sous-route (déroulé, paiement…) n'a pas la forme de l'élément parent (US-048)
async function applyOptimisticCache(operation: OfflineSyncOperation) {
  if (!operation.store || isSubRoute(operation.request)) return

  const current = await getFromStore<any[]>(operation.store, 'list') || []
  if (operation.method === 'DELETE') {
    await saveToStore(operation.store, 'list', current.filter((item) => item.id !== operation.entityId))
    for (const entry of await listStoreEntries('responses')) {
      if (entry.value?.id === operation.entityId) await deleteFromStore('responses', entry.key)
    }
    return
  }

  const now = new Date().toISOString()
  if (operation.method === 'POST') {
    const entity = { ...(operation.body || {}), id: operation.entityId, updatedAt: now, createdAt: operation.body?.createdAt || now, __offlinePending: true }
    await saveToStore(operation.store, 'list', [entity, ...current])
    return
  }

  // La version lue est gardée, jamais l'heure de l'appareil : la modification suivante reste contrôlée (ADR-0036)
  await saveToStore(operation.store, 'list', current.map((item) =>
    item.id === operation.entityId ? { ...item, ...(operation.body || {}), id: item.id, updatedAt: item.updatedAt, __offlinePending: true } : item
  ))
  // Pages de détail gardées : leurs champs simples suivent (nom, description…)
  const scalars = scalarFields(operation.body)
  for (const entry of await listStoreEntries('responses')) {
    if (entry.value?.id === operation.entityId) {
      await saveToStore('responses', entry.key, { ...entry.value, ...scalars, updatedAt: entry.value.updatedAt, __offlinePending: true })
    }
  }
}

function scalarFields(body: any) {
  return Object.fromEntries(Object.entries(body || {}).filter(([key, value]) =>
    !IGNORED_FIELDS.has(key) && (value === null || ['string', 'number', 'boolean'].includes(typeof value))
  ))
}

function optimisticResponse(operation: OfflineSyncOperation, cached: any) {
  if (operation.method === 'DELETE') return { success: true, __offlineQueued: true }
  if (isSubRoute(operation.request)) return { ...(operation.body || {}), __offlineQueued: true }
  return {
    ...(operation.method === 'PUT' ? cached || {} : {}),
    ...(operation.body || {}),
    id: operation.entityId,
    __offlineQueued: true,
    __offlinePending: true
  }
}

// Une modification passée : les suivantes du même élément qui partaient de la même version prennent la
// nouvelle (ADR-0036)
function chainVersion(operation: OfflineSyncOperation, done: OfflineSyncOperation, version: string) {
  if (operation.force || !operation.baseVersion || operation.baseVersion !== done.baseVersion) return operation
  if (versionKeyOf(operation.request) !== versionKeyOf(done.request)) return operation
  return { ...operation, baseVersion: version, headers: { ...(operation.headers || {}), 'if-unmodified-since': version } }
}

function tempId() {
  return `${TEMPORARY_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function clone<T>(value: T): T {
  if (!value) return value
  return JSON.parse(JSON.stringify(value))
}

function references(operation: OfflineSyncOperation, id: string) {
  return operation.request.includes(id) || JSON.stringify(operation.body ?? null).includes(id)
}

function remapTemporaryEntity(operation: OfflineSyncOperation, temporaryId: string, realId: string) {
  const request = operation.request.replace(`/${temporaryId}`, `/${realId}`)
  return {
    ...operation,
    request,
    entityId: operation.entityId === temporaryId ? realId : operation.entityId,
    entityKey: operation.entityKey?.replace(temporaryId, realId),
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
