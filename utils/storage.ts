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
        console.log(`[storage] store "${store}" manquant, on recrée`)

        db.close()
        version += 1

        db = await openDB(DB_NAME, version, {
            upgrade(upgradeDb) {
                if (!upgradeDb.objectStoreNames.contains(store)) {
                    console.log(`[storage] création du store "${store}" dans upgrade`)
                    upgradeDb.createObjectStore(store)
                }
            }
        })
    }

    console.log(`[storage] ouverture prête, stores =`, db.objectStoreNames)
    return db
}

export async function saveToStore<T = any>(store: string, key: string, value: T) {
    console.log(`[storage] saveToStore: ${store}/${key}`, value)
    const db = await ensureStore(store)

    try {
        const tx = db.transaction(store, 'readwrite')
        await tx.store.put(value, key)
        await tx.done
        console.log(`[storage] done saving ${store}/${key}`)
    } catch (err) {
        console.error(`[storage] ERREUR PUT ${store}/${key}`, err)
    }
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
