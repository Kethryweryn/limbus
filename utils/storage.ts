import { deleteDB, openDB } from 'idb'
import { cachedFilesSize, isOfflineDisabled, removeInstalledApp, serializedSize, setOfflineDisabled, storageEstimate, type OfflineStorageSize } from './offlineDevice'
import { forgetSpace } from './spaces'

const DB_NAME = 'limbus-db'
const OFFLINE_AUTH_KEY = 'offlineAuth'
// Compte auquel appartiennent les données hors ligne de l'appareil (survit à une session expirée)
const OFFLINE_OWNER_KEY = 'offlineOwner'
// Durée pendant laquelle l'appli reste consultable hors ligne sans repasser par le serveur
const OFFLINE_AUTH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const PHOTO_CACHE_NAME = 'session-assignment-photos'
// PDF consultés avec le réseau (trombinoscopes, fiches, fiche allergies), gardés par le service worker (US-047)
const DOCUMENT_CACHE_NAME = 'session-documents'
// PDF et photos des jeux téléchargés (SPEC-019, R9) : sans limite de nombre ni de durée, servis par le service worker
// quand le réseau manque (ADR-0081)
export const DOWNLOAD_CACHE_NAME = 'offline-downloads'
// Déconnexion faite sans réseau, à envoyer au serveur dès son retour (US-051)
const PENDING_LOGOUT_KEY = 'limbusPendingLogout'
// responses : dernières réponses des lectures gardées pour le hors ligne (page d'une session, fiche d'un personnage…)
const STORES = ['dashboard', 'games', 'characters', 'factions', 'intrigues', 'items', 'documents', 'timelineEvents', 'participants', 'locations', 'sessions', 'syncQueue', 'responses', 'offlineDownloads']

let dbPromise: ReturnType<typeof openDB> | null = null

async function ensureStore(store: string) {
    if (!STORES.includes(store)) {
        STORES.push(store)
        dbPromise = null
    }

    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, 14, {
            async upgrade(upgradeDb, oldVersion, _newVersion, transaction) {
                for (const storeName of STORES) {
                    if (!upgradeDb.objectStoreNames.contains(storeName)) {
                        upgradeDb.createObjectStore(storeName)
                    }
                }
                // Version 13 (US-193) : un document gardé avant ADR-0072 n'a pas ses rôles, que le serveur ne déduit plus
                // de l'ancien public. Les documents gardés sur l'appareil sont relus au retour du réseau ; les écritures
                // en attente restent
                if (oldVersion && oldVersion < 13) {
                    await transaction.objectStore('documents').clear()
                    const responses = transaction.objectStore('responses')
                    for (const key of await responses.getAllKeys()) {
                        if (String(key).startsWith('/api/documents')) await responses.delete(key)
                    }
                }
            },
            // Un autre onglet veut supprimer la base (déconnexion) : on libère la connexion
            blocking() {
                const current = dbPromise
                dbPromise = null
                current?.then((db) => db.close())
            }
        })
    }

    return await dbPromise
}

export async function saveToStore<T = unknown>(store: string, key: string, value: T) {
    // Hors ligne désactivé sur cet appareil : rien n'y est gardé, file comprise (SPEC-019, R6)
    if (isOfflineDisabled()) return
    const db = await ensureStore(store)

    try {
        const tx = db.transaction(store, 'readwrite')

        // Tentative de clonage sécurisée
        let serializable: T
        try {
            serializable = JSON.parse(JSON.stringify(value))
        } catch (cloneErr) {
            console.warn(`[storage] ⚠️ Impossible de cloner ${store}/${key}, données non enregistrées`)
            console.warn(cloneErr)
            return
        }

        await tx.store.put(serializable, key)
        await tx.done
    } catch (err) {
        console.error(`[storage] ERREUR PUT ${store}/${key}`, err)
    }
}



export async function getFromStore<T = unknown>(store: string, key: string): Promise<T | null> {
    const db = await ensureStore(store)
    const result = await db.get(store, key)
    return result
}

export async function deleteFromStore(store: string, key: string) {
    const db = await ensureStore(store)
    await db.delete(store, key)
}

export async function listStoreEntries<T = unknown>(store: string): Promise<Array<{ key: string, value: T }>> {
    const db = await ensureStore(store)
    const [keys, values] = await Promise.all([db.getAllKeys(store), db.getAll(store)])
    return keys.map((key, index) => ({ key: String(key), value: values[index] }))
}

// Réponse d'une lecture, gardée pour la rouvrir sans réseau (US-047) ; la clé est l'URL demandée
// Dernière réponse gardée par adresse pendant la visite : une fiche relit les mêmes listes (jeux, personnages…) que la
// précédente, et une réponse identique n'est pas réécrite sur l'appareil (US-212). Vidée avec l'appareil
const lastSavedResponses = new Map<string, string>()

// Une écriture faite hors de saveCachedResponse (copie « en attente » de la file) : la prochaine réponse du serveur la
// remplace, même identique à la précédente
export function forgetSavedResponse(request: string) {
    lastSavedResponses.delete(request)
}

export async function saveCachedResponse<T = unknown>(request: string, value: T) {
    const serialized = JSON.stringify(value)
    if (lastSavedResponses.get(request) === serialized) return
    await saveToStore('responses', request, value)
    lastSavedResponses.set(request, serialized)
}

export async function getCachedResponse<T = unknown>(request: string): Promise<T | null> {
    return await getFromStore<T>('responses', request) ?? null
}

type OfflineAuth = {
    userId: string
    name?: string
    email: string
    role: string
    timestamp: string
}

// Mémorise l'utilisateur connecté pour autoriser la consultation hors ligne sur cet appareil.
// Ce n'est pas une preuve d'identité (tout est local) : la sécurité reste côté serveur.
// Hors ligne désactivé (SPEC-019, R6) : l'identité reste en mémoire, le temps de la page ouverte ; une coupure de réseau
// ne ferme pas la page en cours, mais rien n'est écrit sur l'appareil, et Limbus ne s'y rouvre pas sans réseau
let memoryAuth: OfflineAuth | null = null

export function rememberOfflineAuth(user: Omit<OfflineAuth, 'timestamp' | 'userId'> & { id: string }) {
    const value: OfflineAuth = { userId: user.id, name: user.name, email: user.email, role: user.role, timestamp: new Date().toISOString() }
    memoryAuth = value
    if (isOfflineDisabled()) return
    localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(value))
}

export function getOfflineAuth(): OfflineAuth | null {
    if (isOfflineDisabled()) return memoryAuth
    try {
        const value = JSON.parse(localStorage.getItem(OFFLINE_AUTH_KEY) || 'null')
        if (!value?.userId || !value.timestamp) return null
        if (Date.now() - new Date(value.timestamp).getTime() > OFFLINE_AUTH_MAX_AGE_MS) return null
        return value
    } catch {
        return null
    }
}

export function forgetOfflineAuth() {
    memoryAuth = null
    localStorage.removeItem(OFFLINE_AUTH_KEY)
}

// Efface tout ce que l'appli garde sur l'appareil : données en cache (dont les coordonnées
// des participants), écritures en attente et photos mises en cache par le service worker
export async function clearOfflineData() {
    forgetOfflineAuth()
    forgetSpace()
    localStorage.removeItem(OFFLINE_OWNER_KEY)
    await clearDeviceData()
}

// Vide les données gardées (base, PDF, photos, file), sans déconnecter : l'identité hors ligne et le compte
// propriétaire des données restent, pour que Limbus s'ouvre encore sans réseau (SPEC-019, R3)
export async function clearDeviceData() {
    lastSavedResponses.clear()
    const current = dbPromise
    dbPromise = null
    await current?.then((db) => db.close()).catch(() => {})
    await Promise.race([
        deleteDB(DB_NAME).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 3000))
    ])
    if ('caches' in window) {
        await caches.delete(PHOTO_CACHE_NAME).catch(() => false)
        await caches.delete(DOCUMENT_CACHE_NAME).catch(() => false)
        await caches.delete(DOWNLOAD_CACHE_NAME).catch(() => false)
    }
}

export function markPendingLogout() {
    localStorage.setItem(PENDING_LOGOUT_KEY, 'true')
}

export function hasPendingLogout() {
    return localStorage.getItem(PENDING_LOGOUT_KEY) === 'true'
}

export function clearPendingLogout() {
    localStorage.removeItem(PENDING_LOGOUT_KEY)
}

// À la connexion : si les données de l'appareil appartiennent à un autre compte (ou à personne
// de connu), on les efface, sinon ses écritures en attente partiraient sous ce compte-ci
export async function claimOfflineData(userId: string) {
    if (localStorage.getItem(OFFLINE_OWNER_KEY) === userId) return
    await clearOfflineData()
    localStorage.setItem(OFFLINE_OWNER_KEY, userId)
}

// Place prise par les données gardées : enregistrements de la base et fichiers des caches (SPEC-019, R2)
export async function measureOfflineData(): Promise<OfflineStorageSize> {
    const total = await storageEstimate()
    if (isOfflineDisabled()) return { data: 0, total }
    try {
        let data = 0
        for (const store of STORES) {
            const db = await ensureStore(store)
            // Un enregistrement à la fois : la base entière n'est jamais en mémoire
            let cursor = await db.transaction(store).store.openCursor()
            while (cursor) {
                data += serializedSize(cursor.value)
                cursor = await cursor.continue()
            }
        }
        const files = await cachedFilesSize([PHOTO_CACHE_NAME, DOCUMENT_CACHE_NAME, DOWNLOAD_CACHE_NAME])
        return { data: files === null ? null : data + files, total }
    } catch {
        return { data: null, total }
    }
}

// Désactive le hors ligne sur cet appareil : tout est effacé, identité hors ligne et application gardée comprises
// (SPEC-019, R5). Le réglage passe en premier, pour qu'aucune lecture en cours ne garde plus rien
export async function disableOfflineOnDevice() {
    setOfflineDisabled(true)
    localStorage.removeItem(OFFLINE_AUTH_KEY)
    await clearDeviceData()
    await removeInstalledApp()
}
