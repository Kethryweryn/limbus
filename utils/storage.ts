import { deleteDB, openDB } from 'idb'

const DB_NAME = 'limbus-db'
const OFFLINE_AUTH_KEY = 'offlineAuth'
// Compte auquel appartiennent les données hors ligne de l'appareil (survit à une session expirée)
const OFFLINE_OWNER_KEY = 'offlineOwner'
// Durée pendant laquelle l'appli reste consultable hors ligne sans repasser par le serveur
const OFFLINE_AUTH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const PHOTO_CACHE_NAME = 'session-assignment-photos'
// PDF consultés avec le réseau (trombinoscopes, fiches, fiche allergies), gardés par le service worker (US-047)
const DOCUMENT_CACHE_NAME = 'session-documents'
// Déconnexion faite sans réseau, à envoyer au serveur dès son retour (US-051)
const PENDING_LOGOUT_KEY = 'limbusPendingLogout'
// responses : dernières réponses des lectures gardées pour le hors ligne (page d'une session, fiche d'un personnage…)
const STORES = ['dashboard', 'games', 'characters', 'factions', 'intrigues', 'items', 'documents', 'timelineEvents', 'participants', 'locations', 'sessions', 'syncQueue', 'responses']

let dbPromise: ReturnType<typeof openDB> | null = null

async function ensureStore(store: string) {
    if (!STORES.includes(store)) {
        STORES.push(store)
        dbPromise = null
    }

    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, 12, {
            upgrade(upgradeDb) {
                for (const storeName of STORES) {
                    if (!upgradeDb.objectStoreNames.contains(storeName)) {
                        upgradeDb.createObjectStore(storeName)
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

export async function saveToStore<T = any>(store: string, key: string, value: T) {
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



export async function getFromStore<T = any>(store: string, key: string): Promise<T | null> {
    const db = await ensureStore(store)
    const result = await db.get(store, key)
    return result
}

export async function deleteFromStore(store: string, key: string) {
    const db = await ensureStore(store)
    await db.delete(store, key)
}

export async function listStoreEntries<T = any>(store: string): Promise<Array<{ key: string, value: T }>> {
    const db = await ensureStore(store)
    const [keys, values] = await Promise.all([db.getAllKeys(store), db.getAll(store)])
    return keys.map((key, index) => ({ key: String(key), value: values[index] }))
}

// Réponse d'une lecture, gardée pour la rouvrir sans réseau (US-047) ; la clé est l'URL demandée
export async function saveCachedResponse<T = any>(request: string, value: T) {
    await saveToStore('responses', request, value)
}

export async function getCachedResponse<T = any>(request: string): Promise<T | null> {
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
export function rememberOfflineAuth(user: Omit<OfflineAuth, 'timestamp' | 'userId'> & { id: string }) {
    const value: OfflineAuth = { userId: user.id, name: user.name, email: user.email, role: user.role, timestamp: new Date().toISOString() }
    localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(value))
}

export function getOfflineAuth(): OfflineAuth | null {
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
    localStorage.removeItem(OFFLINE_AUTH_KEY)
}

// Efface tout ce que l'appli garde sur l'appareil : données en cache (dont les coordonnées
// des participants), écritures en attente et photos mises en cache par le service worker
export async function clearOfflineData() {
    forgetOfflineAuth()
    localStorage.removeItem(OFFLINE_OWNER_KEY)
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
