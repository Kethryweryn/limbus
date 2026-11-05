import type { prisma } from '../../server/utils/prisma'

// Le client de la transaction du rechargement
export type Db = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
