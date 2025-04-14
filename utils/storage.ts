import { openDB } from 'idb'

const DB_NAME = 'limbus-db'

let currentVersion = 1
let dbInstance: IDBDatabase | null = null

async function ensureStore(store: string) {
    const dbs = await indexedDB.databases?.()
    const existing = dbs?.find(db => db.name === DB_NAME)

    // Récupère la version actuelle, ou démarre à 1
    currentVersion = existing?.version ?? 1

    const db = await openDB(DB_NAME, currentVersion)

    if (!db.objectStoreNames.contains(store)) {
        db.close()

        currentVersion += 1
        return openDB(DB_NAME, currentVersion, {
            upgrade(upgradeDb) {
                if (!upgradeDb.objectStoreNames.contains(store)) {
                    upgradeDb.createObjectStore(store)
                }
            }
        })
    }

    return db
}

export async function saveToStore<T = any>(store: string, key: string, value: T) {
    console.log(`[storage] saveToStore: ${store}/${key}`, value)
    const db = await ensureStore(store)
    await db.put(store, value, key)
    console.log(`[storage] done saving ${store}/${key}`)
}


export async function getFromStore<T = any>(store: string, key: string): Promise<T | null> {
    const db = await ensureStore(store)
    const result = await db.get(store, key)
    console.log(`[storage] getFromStore: ${store}/${key}`, result)
    return result
}

export async function deleteFromStore(store: string, key: string) {
    const db = await ensureStore(store)
    await db.delete(store, key)
}
