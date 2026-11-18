// SPEC-023, US-252 : téléphones vérifiés selon leur pays et rangés au format international, contact d'urgence complet
import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf, invalidMessages, invalidPaths } from './api'
import { createTestPrisma } from './db'
import { withFicheValues } from '../fiche'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let counter = 0
const unique = (name: string) => `${name}-tel-${++counter}@example.test`
const INVALID = 'Numéro de téléphone invalide'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('téléphones (SPEC-023, R4 à R7)', () => {
  it('fiche participant : rangé au format international, refusé s’il n’est pas un numéro', async () => {
    const email = unique('fiche')
    const refused = await api(alice, 'POST', '/api/participants', { name: 'Iris Martin', email, phone: '06 12 34', gameIds: [world.a.game.id] })
    expect(refused.status).toBe(400)
    expect(invalidPaths(refused)).toEqual(['phone'])
    expect(invalidMessages(refused)).toEqual([INVALID])
    expect(await prisma.participant.count({ where: { email } })).toBe(0)

    const created = await api(alice, 'POST', '/api/participants', { name: 'Iris Martin', email, phone: '06.12.34.56.78', gameIds: [world.a.game.id] })
    expect(created.status, JSON.stringify(created.body)).toBe(200)
    const { id } = created.body as { id: string }
    expect((await prisma.participantGame.findFirstOrThrow({ where: { participantId: id } })).phone).toBe('+33612345678')

    const foreign = await api(alice, 'PUT', `/api/participants/${id}`, { name: 'Iris Martin', email, phone: '+32 470 12 34 56', gameIds: [world.a.game.id] })
    expect(foreign.status, JSON.stringify(foreign.body)).toBe(200)
    expect((await prisma.participantGame.findFirstOrThrow({ where: { participantId: id } })).phone).toBe('+32470123456')
    expect(invalidPaths(await api(alice, 'PUT', `/api/participants/${id}`, { name: 'Iris Martin', email, phone: 'bonjour', gameIds: [world.a.game.id] }))).toEqual(['phone'])
  })

  it('un numéro déjà enregistré et non reconnu passe tant qu’il ne change pas (R12)', async () => {
    const key = `ancien-tel-${++counter}`
    const email = unique(key)
    const person = await withFicheValues(prisma.participant.create({ data: { slug: key, email, gameLinks: { create: { gameId: world.a.game.id, name: 'Ancien Numéro', phone: 'standard' } } } }), { name: 'Ancien Numéro' })
    const kept = await api(alice, 'PUT', `/api/participants/${person.id}`, { name: 'Ancien Numéro', email, phone: 'standard', gameIds: [world.a.game.id], gameNotes: { [world.a.game.id]: 'Note' } })
    expect(kept.status, JSON.stringify(kept.body)).toBe(200)
    expect(invalidPaths(await api(alice, 'PUT', `/api/participants/${person.id}`, { name: 'Ancien Numéro', email, phone: 'standard 2', gameIds: [world.a.game.id] }))).toEqual(['phone'])
  })

  it('Mes coordonnées : téléphones rangés, contact d’urgence complet (R8)', async () => {
    const user = await prisma.user.create({ data: { email: unique('compte'), name: 'Camille Dupont', password: 'non-utilise', emailConfirmedAt: new Date() } })
    const invalid = await api(user, 'PUT', '/api/account/profile', { phone: '12', emergencyContactName: 'Paul Martin', emergencyContactPhone: '0698765432' })
    expect(invalidPaths(invalid)).toEqual(['phone'])

    const half = await api(user, 'PUT', '/api/account/profile', { emergencyContactName: 'Paul Martin' })
    expect(half.status).toBe(400)
    expect(invalidPaths(half)).toEqual(['emergencyContactPhone'])
    expect(invalidMessages(half)).toEqual(['Le téléphone du contact d’urgence est obligatoire'])
    expect(invalidPaths(await api(user, 'PUT', '/api/account/profile', { emergencyContactPhone: '0698765432' }))).toEqual(['emergencyContactName'])

    const saved = await api(user, 'PUT', '/api/account/profile', { phone: '06 12 34 56 78', emergencyContactName: 'Paul Martin', emergencyContactPhone: '+41 79 123 45 67' })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    // La réponse rend la forme rangée, que l'écran affiche aussitôt (retour A9-3 du cahier)
    expect(bodyOf<ApiResponse<'/api/account/profile', 'put'>>(saved).profile).toMatchObject({ phone: '+33612345678', emergencyContactPhone: '+41791234567' })
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, emergencyContactName: true, emergencyContactPhone: true } }))
      .toEqual({ phone: '+33612345678', emergencyContactName: 'Paul Martin', emergencyContactPhone: '+41791234567' })
    // Les deux vides restent acceptés : le contact est facultatif dans le compte
    expect((await api(user, 'PUT', '/api/account/profile', {})).status).toBe(200)
  })
})

describe('migration des téléphones déjà en base (R12, ADR-0092)', () => {
  it('range les formes sûres au format international et laisse les autres', async () => {
    const sql = readFileSync(new URL('../../prisma/migrations/20261215090000_telephones_au_format/migration.sql', import.meta.url), 'utf8')
    const create = sql.slice(sql.indexOf('CREATE FUNCTION'), sql.indexOf('$$;') + 3)
    const cases: Record<string, string> = {
      '06 12 34 56 78': '+33612345678',
      '06.12.34.56.78': '+33612345678',
      '(06) 12-34-56-78': '+33612345678',
      '+33 (0)6 12 34 56 78': '+33612345678',
      '0033 (0)6 12 34 56 78': '+33612345678',
      '0033612345678': '+33612345678',
      '+32 470 12 34 56': '+32470123456',
      '12': '12',
      'bonjour': 'bonjour',
      '00 12 34 56 78': '00 12 34 56 78'
    }
    // Fonction temporaire de la migration, sur une seule connexion
    const converted = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(create)
      return await tx.$queryRawUnsafe<Array<{ typed: string, stored: string }>>(
        'SELECT typed, pg_temp.telephone_au_format(typed) AS stored FROM unnest($1::text[]) AS typed',
        Object.keys(cases)
      )
    })
    expect(Object.fromEntries(converted.map((row) => [row.typed, row.stored]))).toEqual(cases)
  })
})
