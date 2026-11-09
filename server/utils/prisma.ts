// server/utils/prisma.ts
import { randomBytes } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function getDatabaseUrl() {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required')
    }
    return databaseUrl
}

/** Violation d'une contrainte d'unicité, sur un champ donné si `field` est précisé. */
export function isUniqueConflict(error: unknown, field?: string) {
    const { code, meta } = (error || {}) as { code?: string, meta?: unknown }
    return code === 'P2002' && (!field || JSON.stringify(meta ?? {}).includes(field))
}

export function isSlugConflict(error: unknown) {
    return isUniqueConflict(error, 'slug')
}

// Deux enregistrements simultanés du même nom calculent le même slug (generateUniqueSlug lit puis écrit) :
// le second échoue sur la contrainte d'unicité. On le réessaie une fois avec un suffixe aléatoire.
async function withSlugRetry<A extends { data?: unknown }, T>(args: A, query: (args: A) => Promise<T>): Promise<T> {
    try {
        return await query(args)
    } catch (error) {
        const data = args.data as { slug?: unknown } | undefined
        if (typeof data?.slug !== 'string' || !isSlugConflict(error)) throw error
        return await query({ ...args, data: { ...data, slug: `${data.slug}-${randomBytes(2).toString('hex')}` } } as A)
    }
}

function createPrismaClient() {
    return new PrismaClient({
        adapter: new PrismaPg({
            connectionString: getDatabaseUrl()
        }),
        log: ['error', 'warn'],
    }).$extends({
        query: {
            $allModels: {
                create: ({ args, query }) => withSlugRetry(args, query),
                update: ({ args, query }) => withSlugRetry(args, query)
            }
        }
    })
}

const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Le client d'une transaction, passé aux fonctions qui écrivent dedans
export type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
