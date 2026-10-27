import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '~/generated/prisma/client'

export function testDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('TEST_DATABASE_URL est requis pour les tests d’intégration')

  // Garde-fou : la base est entièrement vidée, on refuse tout ce qui ne ressemble pas à une base de test
  const databaseName = new URL(url).pathname.slice(1)
  if (!databaseName.includes('test')) {
    throw new Error(`Refus de vider la base « ${databaseName} » : son nom doit contenir « test »`)
  }
  return url
}

export function createTestPrisma() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl() }) })
}
