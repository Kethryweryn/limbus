// US-188 : toute clé étrangère est couverte par un index, sans quoi une liste filtrée par elle et une suppression en
// cascade parcourent toute la table. Vaut pour les tables à venir.
import { afterAll, describe, expect, it } from 'vitest'
import { createTestPrisma } from './db'

const prisma = createTestPrisma()

afterAll(async () => {
  await prisma.$disconnect()
})

describe('schéma de données', () => {
  it('couvre chaque clé étrangère par un index qui commence par ses colonnes', async () => {
    const uncovered = await prisma.$queryRaw<Array<{ constraint: string }>>`
      SELECT c.conname AS "constraint"
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid
            -- Un index partiel ou sur une expression ne sert pas aux recherches sur toute la clé
            AND i.indpred IS NULL
            AND i.indexprs IS NULL
            AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
            AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey
        )
      ORDER BY 1`
    expect(uncovered.map((row) => row.constraint)).toEqual([])
  })
})
