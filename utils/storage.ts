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
    const db = await ensureStore(store)
    await db.put(store, value, key)
}

export async function getFromStore<T = any>(store: string, key: string): Promise<T | null> {
    const db = await ensureStore(store)
    return db.get(store, key)
}

export async function deleteFromStore(store: string, key: string) {
    const db = await ensureStore(store)
    await db.delete(store, key)
}
