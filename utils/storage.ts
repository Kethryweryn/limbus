import { openDB, DBSchema } from 'idb'

interface LimbusDB extends DBSchema {
    [store: string]: {
        key: string
        value: any
    }
}

const DB_NAME = 'limbus-db'
const DB_VERSION = 1

export async function getDB() {
    return openDB<LimbusDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // On ne crée pas de store ici — il sera créé dynamiquement si besoin
        }
    })
}

export async function saveToStore<T = any>(store: string, key: string, value: T) {
    const db = await getDB()

    // Créer dynamiquement un store si absent
    if (!db.objectStoreNames.contains(store)) {
        db.close()
        const newDB = await openDB<LimbusDB>(DB_NAME, DB_VERSION + 1, {
            upgrade(upgradeDb) {
                if (!upgradeDb.objectStoreNames.contains(store)) {
                    upgradeDb.createObjectStore(store)
                }
            }
        })
        await newDB.put(store, value, key)
        return
    }

    await db.put(store, value, key)
}

export async function getFromStore<T = any>(store: string, key: string): Promise<T | null> {
    const db = await getDB()
    if (!db.objectStoreNames.contains(store)) return null
    return db.get(store, key)
}

export async function deleteFromStore(store: string, key: string) {
    const db = await getDB()
    if (!db.objectStoreNames.contains(store)) return
    await db.delete(store, key)
}
