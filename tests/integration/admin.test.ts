// US-043 : Limbus garde toujours une administratrice
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'

const world = inject('world')
const { admin } = world.users
const prisma = createTestPrisma()

afterAll(async () => {
  await prisma.$disconnect()
})

describe('dernière administratrice (US-043)', () => {
  it('retire le rôle d’une administratrice tant qu’il en reste une autre, jamais de la dernière', async () => {
    const other = await prisma.user.create({ data: { email: 'autre-admin@example.test', name: 'Autre', password: 'non-utilise', role: 'admin' } })
    expect((await api(admin, 'PUT', `/api/admin/users/${other.id}`, { role: 'user' })).status).toBe(200)

    // Les administratrices créées par d'autres tests sont mises de côté le temps du test, puis rétablies
    const others = await prisma.user.findMany({ where: { role: 'admin', id: { not: admin.id } }, select: { id: true } })
    await prisma.user.updateMany({ where: { id: { in: others.map((user) => user.id) } }, data: { role: 'user' } })
    try {
      const refused = await api(admin, 'PUT', `/api/admin/users/${admin.id}`, { role: 'user' })
      expect(refused.status).toBe(409)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe('admin')
    } finally {
      await prisma.user.updateMany({ where: { id: { in: others.map((user) => user.id) } }, data: { role: 'admin' } })
    }
  })
})
