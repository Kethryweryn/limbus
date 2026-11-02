import bcrypt from 'bcrypt'
import { expect } from 'vitest'
import { api } from './api'
import type { createTestPrisma } from './db'

let counter = 0

// Les purges (copies, formulaires non confirmés, photos échues) passent après chaque connexion réussie
// (server/api/auth/login.post.ts) : un compte jetable s'y connecte
export async function triggerPurge(prisma: ReturnType<typeof createTestPrisma>) {
  const email = `purge-${Date.now()}-${++counter}@example.test`
  await prisma.user.create({ data: { email, name: 'Purge', password: await bcrypt.hash('mot-de-passe-solide', 4) } })
  const login = await api(null, 'POST', '/api/auth/login', { email, password: 'mot-de-passe-solide' })
  expect(login.status, JSON.stringify(login.body)).toBe(200)
}
