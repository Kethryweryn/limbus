import { openDB } from 'idb'

const DB_NAME = 'limbus-db'

let currentVersion = 1
let dbInstance: IDBDatabase | null = null

async function ensureStore(store: string) {
    const dbs = await indexedDB.databases?.()
    const existing = dbs?.find(db => db.name === DB_NAME)
    let version = existing?.version ?? 1

    // Tente d’ouvrir la DB existante
    let db = await openDB(DB_NAME, version)

    if (!db.objectStoreNames.contains(store)) {
        db.close()
        version += 1

        db = await openDB(DB_NAME, version, {
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
