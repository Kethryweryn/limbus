import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PARTICIPANT_KEYS, latestVisibleValues, namesIn, withGameValues } from '~/server/utils/participantValues'
import { prisma } from '~/server/utils/prisma'

// Nom et téléphone tenus par jeu (SPEC-022 R6, ADR-0086, US-237) : la fiche n'en a plus (US-242)
const links = [
  { gameId: 'jeu-a', participantId: 'paul', name: 'Paul chez A', phone: '0611' },
  { gameId: 'jeu-b', participantId: 'paul', name: 'Paul chez B', phone: '0622' },
  { gameId: 'jeu-a', participantId: 'vide', name: null, phone: null }
]
const findMany = vi.fn()

beforeEach(() => {
  findMany.mockReset().mockImplementation(async ({ where }: { where: { OR?: Array<{ gameId: string, participantId: { in: string[] } }>, gameId?: string, participantId?: { in: string[] } } }) => {
    const pairs = where.OR ?? [{ gameId: where.gameId!, participantId: where.participantId! }]
    return links.filter((link) => pairs.some((pair) => pair.gameId === link.gameId && pair.participantId.in.includes(link.participantId)))
  })
  Object.assign(prisma, {
    participantGame: { findMany }
  })
})

describe('withGameValues', () => {
  it('lit chaque fiche dans le jeu de l’objet le plus proche qui en porte un', async () => {
    const read = await withGameValues({
      sessions: [
        { gameId: 'jeu-a', participants: [{ role: 'participant', participant: { id: 'paul' } }] },
        { gameId: 'jeu-b', assignments: [{ participant: { id: 'paul' } }] }
      ]
    }, undefined, { phone: true })
    expect(read.sessions[0]!.participants![0]!.participant).toEqual({ id: 'paul', name: 'Paul chez A', phone: '0611' })
    expect(read.sessions[1]!.assignments![0]!.participant).toEqual({ id: 'paul', name: 'Paul chez B', phone: '0622' })
  })

  it('prend le jeu donné quand la lecture n’en porte pas, et donne un nom vide pour un lien sans valeur', async () => {
    const read = await withGameValues([{ targetParticipant: { id: 'paul' } }, { transferredTo: { id: 'vide' } }], 'jeu-a')
    expect(read[0]!.targetParticipant?.name).toBe('Paul chez A')
    expect(read[0]!.targetParticipant).not.toHaveProperty('phone')
    expect(read[1]!.transferredTo?.name).toBe('')
  })

  it('ne touche ni une clé qui n’est pas une fiche, ni une lecture sans jeu', async () => {
    const read = await withGameValues({ character: { id: 'paul', name: 'Héros' }, participant: { id: 'paul', name: 'Paul fiche' } })
    expect(read).toEqual({ character: { id: 'paul', name: 'Héros' }, participant: { id: 'paul', name: 'Paul fiche' } })
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe('namesIn et latestVisibleValues', () => {
  it('donne le nom du jeu, vide pour un lien sans valeur', async () => {
    const names = await namesIn('jeu-a', ['paul', 'vide'])
    expect(Object.fromEntries(names)).toEqual({ paul: 'Paul chez A', vide: '' })
  })

  it('hors d’un jeu précis, prend le lien visible le plus récemment modifié', () => {
    const fiche = latestVisibleValues({
      gameLinks: [
        { name: 'Ancien', phone: '0601', updatedAt: new Date('2026-01-01') },
        { name: 'Récent', phone: '0602', updatedAt: new Date('2026-06-01') }
      ]
    })
    expect(fiche).toMatchObject({ name: 'Récent', phone: '0602' })
  })
})

describe('clés de fiche', () => {
  it('reconnaît chaque relation du schéma vers une fiche participant', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8')
    const relations = [...schema.matchAll(/^\s+(\w+)\s+Participant\??\s+@relation/gm)].map((match) => match[1])
    expect(relations.length).toBeGreaterThan(0)
    expect(relations.filter((name) => !PARTICIPANT_KEYS.has(name!))).toEqual([])
  })
})
