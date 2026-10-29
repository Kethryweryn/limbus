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
    expect((await api(admin, 'PUT', `/api/admin/users/${other.id}`, { role: 'organizer' })).status).toBe(200)

    // Les autres administratrices éventuelles des autres tests ne comptent pas : on n'en garde qu'une
    await prisma.user.updateMany({ where: { role: 'admin', id: { not: admin.id } }, data: { role: 'organizer' } })
    const refused = await api(admin, 'PUT', `/api/admin/users/${admin.id}`, { role: 'organizer' })
    expect(refused.status).toBe(409)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe('admin')
  })
})
