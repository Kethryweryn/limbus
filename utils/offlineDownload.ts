import { isNetworkError, getErrorStatus } from './connection'
import { getOfflineQueue } from './offlineSync'
import {
  AUTH_READ, characterPlan, DASHBOARD_READ, filesIn, gameRead, gameSheetRead, isUpcoming, LIST_READS, participantPlan,
  REGISTRATION_PERIODS_READ, registrationReads, sessionPlan, sessionReads, sheetReads
} from './offlinePlan'
import { DOWNLOAD_CACHE_NAME, deleteFromStore, getCachedResponse, getFromStore, listStoreEntries, saveCachedResponse, saveToStore } from './storage'

// Téléchargement d'un jeu pour le hors ligne (SPEC-019, R8 à R13 ; ADR-0081) : le navigateur lit ce que liraient les
// pages du jeu, et garde chaque réponse comme si la page l'avait ouverte

export const DOWNLOADS_STORE = 'offlineDownloads'

export type OfflineDownload = {
  gameId: string
  title: string
  // Accès retiré ou jeu supprimé (R15) : ses données sont effacées, la section le dit
  lost?: boolean
  // Dernier téléchargement complet
  date: string
  responses: string[]
  files: string[]
  size: number
}

export type DownloadProgress = { done: number, total: number }

// Réseau tombé pendant le téléchargement (R11) ; accès au jeu refusé (R15)
export class DownloadInterrupted extends Error {}
export class GameAccessLost extends Error {}

type Listed = { id: string, slug: string, gameId?: string | null, games?: Array<{ id: string }>, date?: string | null }

const rawFetch = $fetch as unknown as (request: string) => Promise<unknown>

// Quatre lectures à la fois : un gros jeu demande des centaines de lectures, sans charger le serveur pour autant
const PARALLEL_READS = 4

async function eachInParallel<T>(items: Iterable<T>, run: (item: T) => Promise<void>) {
  const pending = [...items]
  const worker = async () => {
    for (let item = pending.shift(); item !== undefined; item = pending.shift()) await run(item)
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL_READS, pending.length) }, worker))
}

export async function listDownloads() {
  return (await listStoreEntries<OfflineDownload>(DOWNLOADS_STORE)).map((entry) => entry.value)
}

async function read(url: string) {
  try {
    return await rawFetch(url)
  } catch (error) {
    if (isNetworkError(error)) throw new DownloadInterrupted('Le réseau est tombé pendant le téléchargement.')
    throw error
  }
}

export async function downloadGame(target: { id: string, title: string }, onProgress: (progress: DownloadProgress) => void = () => {}) {
  const queue = await getOfflineQueue()
  // Une modification en attente garde sa copie sur l'appareil (R12)
  const pendingStores = new Set(queue.map((operation) => operation.store).filter(Boolean))
  const responses = new Set<string>()
  const files = new Set<string>()
  let size = 0
  const progress = { done: 0, total: LIST_READS.length + 4 }
  const step = () => { progress.done++; onProgress({ ...progress }) }

  async function keep(url: string, value: unknown) {
    const current = await getCachedResponse<{ __offlinePending?: boolean }>(url)
    if (current?.__offlinePending) return
    await saveCachedResponse(url, value)
    responses.add(url)
  }

  // Une fiche introuvable ou refusée (élément supprimé entre-temps) est sautée ; le réseau tombé arrête tout
  async function keepRead(url: string) {
    try {
      const value = await read(url)
      await keep(url, value)
      return value
    } catch (error) {
      if (error instanceof DownloadInterrupted) throw error
      if ([403, 404].includes(getErrorStatus(error) ?? 0)) return null
      throw error
    } finally {
      step()
    }
  }

  onProgress({ ...progress })
  // Le jeu lui-même, par son identifiant : refusé, il n'est plus accessible (R15)
  let game: { id: string, slug: string, title: string }
  try {
    game = await read(gameRead(target.id)) as typeof game
  } catch (error) {
    if ([403, 404].includes(getErrorStatus(error) ?? 0)) throw new GameAccessLost('Ce jeu n’est plus accessible.')
    throw error
  }
  await keep(gameSheetRead(game.slug), await read(gameSheetRead(game.slug)))
  step()

  const lists: Record<string, Listed[]> = {}
  for (const [store, url] of LIST_READS) {
    const value = await read(url) as Listed[]
    lists[store] = value
    if (!pendingStores.has(store)) await saveToStore(store, 'list', value)
    await keep(url, value)
    step()
  }
  await keepRead(DASHBOARD_READ)
  await keepRead(AUTH_READ)
  const periods = await keepRead(REGISTRATION_PERIODS_READ) as Array<{ id: string, gameId: string }> | null

  const ofGame = (store: string) => (lists[store] || []).filter((item) => item.gameId === game.id)
  const sessions = ofGame('sessions')
  const participants = (lists.participants || []).filter((item) => item.games?.some((linked) => linked.id === game.id))
  const sheets: string[] = [
    ...ofGame('characters').flatMap((character) => characterPlan({ ...character, gameId: game.id })),
    ...ofGame('factions').map((item) => sheetReads.faction(item.slug)),
    ...ofGame('intrigues').map((item) => sheetReads.intrigue(item.slug)),
    ...ofGame('items').map((item) => sheetReads.item(item.slug)),
    ...ofGame('documents').map((item) => sheetReads.document(item.slug)),
    ...ofGame('timelineEvents').map((item) => sheetReads.timelineEvent(item.slug)),
    ...ofGame('locations').map((item) => sheetReads.location(item.slug)),
    ...participants.flatMap(participantPlan),
    ...sessions.flatMap(sessionPlan)
  ]
  const gamePeriods = (periods || []).filter((period) => period.gameId === game.id)
  const periodReads = gamePeriods.flatMap((period) => [registrationReads.selection(period.id), registrationReads.draws(period.id), registrationReads.registrations(period.id)])
  progress.total += new Set(sheets).size + periodReads.length
  onProgress({ ...progress })

  await eachInParallel(new Set(sheets), async (url) => { await keepRead(url) })
  for (const url of periodReads) {
    const value = await keepRead(url)
    if (url.endsWith('/registrations') && Array.isArray(value)) {
      const ids = value.map((registration: { id?: string }) => registration.id).filter((id): id is string => Boolean(id))
      progress.total += ids.length
      await eachInParallel(ids, async (id) => { await keepRead(registrationReads.registration(id)) })
    }
  }

  // Fichiers des sessions à venir seulement (R9), dans un cache sans limite de nombre ni de durée
  const wanted = new Set<string>()
  for (const session of sessions.filter((item) => isUpcoming(item))) {
    filesIn(await getCachedResponse(sessionReads.sheet(session.slug)), wanted)
    filesIn(await getCachedResponse(sessionReads.documents(session.id)), wanted)
    wanted.add(sessionReads.allergiesPdf(session.id))
  }
  progress.total += wanted.size
  onProgress({ ...progress })
  const cache = await caches.open(DOWNLOAD_CACHE_NAME)
  await eachInParallel(wanted, async (url) => {
    let response: Response
    try {
      response = await fetch(url, { credentials: 'same-origin' })
    } catch {
      throw new DownloadInterrupted('Le réseau est tombé pendant le téléchargement.')
    }
    if (response.ok) {
      size += (await response.clone().blob()).size
      await cache.put(url, response)
      files.add(url)
    }
    step()
  })

  const download: OfflineDownload = { gameId: game.id, title: game.title, date: new Date().toISOString(), responses: [...responses], files: [...files], size }
  await saveToStore(DOWNLOADS_STORE, game.id, download)
  return download
}

// Jeu effacé de l'appareil (accès perdu, R15) : ses réponses et ses fichiers, sauf ceux d'un autre téléchargement, et
// ses lignes dans les listes
export async function forgetDownloadedGame(gameId: string) {
  const downloads = await listDownloads()
  const lost = downloads.find((download) => download.gameId === gameId)
  if (!lost) return
  const kept = downloads.filter((download) => download.gameId !== gameId)
  const keptResponses = new Set(kept.flatMap((download) => download.responses))
  const keptFiles = new Set(kept.flatMap((download) => download.files))
  const listUrls = new Set<string>(LIST_READS.map(([, url]) => url))
  for (const url of lost.responses) {
    if (keptResponses.has(url) || listUrls.has(url) || url === DASHBOARD_READ || url === AUTH_READ || url === REGISTRATION_PERIODS_READ) continue
    await deleteFromStore('responses', url)
  }
  const cache = await caches.open(DOWNLOAD_CACHE_NAME)
  for (const url of lost.files) if (!keptFiles.has(url)) await cache.delete(url)
  // Listes communes à tous les jeux : seules les lignes du jeu perdu partent
  for (const [store, url] of LIST_READS) {
    const without = (items: unknown) => Array.isArray(items)
      ? items.filter((item: Listed) => item.gameId !== gameId && item.id !== gameId && !(item.games?.length === 1 && item.games[0]?.id === gameId))
      : items
    const list = await getFromStore(store, 'list')
    if (list) await saveToStore(store, 'list', without(list))
    const response = await getCachedResponse(url)
    if (response) await saveCachedResponse(url, without(response))
  }
  // Le tableau de bord mêle les jeux : il se relira avec le réseau
  await deleteFromStore('dashboard', 'main')
  await deleteFromStore('responses', DASHBOARD_READ)
  // Le jeu reste dans le registre, marqué perdu, pour que la section le dise ; l'effacement de l'appareil l'en retire
  await saveToStore(DOWNLOADS_STORE, gameId, { ...lost, lost: true, responses: [], files: [], size: 0 })
}

// Mise à jour des jeux téléchargés (R14) : à l'ouverture de Limbus et au retour du réseau, en arrière-plan, au plus une
// fois par heure par jeu, un jeu à la fois. Un jeu refusé part de l'appareil (R15)
export const REFRESH_AFTER_MS = 60 * 60 * 1000
let refreshing: Promise<void> | null = null

export function refreshDownloads(now = Date.now()) {
  refreshing ??= (async () => {
    try {
      for (const download of await listDownloads()) {
        if (download.lost || now - new Date(download.date).getTime() < REFRESH_AFTER_MS) continue
        if (!navigator.onLine) return
        try {
          await downloadGame({ id: download.gameId, title: download.title })
        } catch (error) {
          if (error instanceof GameAccessLost) await forgetDownloadedGame(download.gameId)
          // Réseau tombé ou panne : la prochaine ouverture, ou le prochain retour du réseau, recommencera
          else if (error instanceof DownloadInterrupted) return
        }
      }
    } finally {
      refreshing = null
      window.dispatchEvent(new CustomEvent('limbus:offline-downloads'))
    }
  })()
  return refreshing
}
