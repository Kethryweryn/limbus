import { openDB } from 'idb'

const DB_NAME = 'limbus-db'
const STORES = ['dashboard', 'games', 'characters', 'players', 'locations', 'sessions']

let dbPromise: ReturnType<typeof openDB> | null = null

async function ensureStore(store: string) {
    if (!STORES.includes(store)) {
        STORES.push(store)
        dbPromise = null
    }

    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, 5, {
            upgrade(upgradeDb) {
                for (const storeName of STORES) {
                    if (!upgradeDb.objectStoreNames.contains(storeName)) {
                        upgradeDb.createObjectStore(storeName)
                    }
                }
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
