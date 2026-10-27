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

export function isSlugConflict(error: unknown) {
    const { code, meta } = (error || {}) as { code?: string, meta?: unknown }
    return code === 'P2002' && JSON.stringify(meta ?? {}).includes('slug')
}

// Deux enregistrements simultanés du même nom calculent le même slug (generateUniqueSlug lit puis écrit) :
// le second échoue sur la contrainte d'unicité. On le réessaie une fois avec un suffixe aléatoire.
async function withSlugRetry<T>(args: { data?: unknown }, query: (args: any) => Promise<T>): Promise<T> {
    try {
        return await query(args)
    } catch (error) {
        const data = args.data as { slug?: unknown } | undefined
        if (typeof data?.slug !== 'string' || !isSlugConflict(error)) throw error
        return await query({ ...args, data: { ...data, slug: `${data.slug}-${randomBytes(2).toString('hex')}` } })
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
