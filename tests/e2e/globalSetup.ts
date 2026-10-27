import { execFileSync } from 'node:child_process'
import bcrypt from 'bcrypt'
import { createTestPrisma, testDatabaseUrl } from '../integration/db'
import { E2E_PASSWORD, E2E_USERS } from './constants'

export default async function globalSetup() {
  execFileSync('npx', ['prisma', 'migrate', 'reset', '--force'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
    shell: process.platform === 'win32'
  })

  const prisma = createTestPrisma()
  const password = await bcrypt.hash(E2E_PASSWORD, 4)
  const users = await Promise.all(Object.values(E2E_USERS).map((email) =>
    prisma.user.create({ data: { email, name: email.split('@')[0]!, password } })
  ))

  await prisma.game.create({
    data: { title: 'Jeu avec teaser', slug: 'jeu-teaser', description: '', publicPage: true, ownerId: users[0]!.id, teaserUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
  })
  // Valeur dangereuse écrite directement en base (l'API la refuse) : le front ne doit pas l'exécuter
  await prisma.game.create({
    data: { title: 'Jeu piégé', slug: 'jeu-piege', description: '', publicPage: true, ownerId: users[0]!.id, teaserUrl: 'javascript:alert(document.domain)' }
  })
  await prisma.$disconnect()
}
