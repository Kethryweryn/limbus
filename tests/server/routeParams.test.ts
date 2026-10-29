import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import { requireRouterParam } from '~/server/utils/routeParams'

const eventWith = (params: Record<string, string>) => ({ context: { params } }) as unknown as H3Event

describe('requireRouterParam', () => {
  it('renvoie la valeur du paramètre', () => {
    expect(requireRouterParam(eventWith({ id: 'g1' }), 'id')).toBe('g1')
  })

  it('400 avec un message propre au paramètre, ou générique', () => {
    expect(() => requireRouterParam(eventWith({}), 'id')).toThrowError(expect.objectContaining({ statusCode: 400, message: 'ID manquant' }))
    expect(() => requireRouterParam(eventWith({}), 'slug')).toThrowError(expect.objectContaining({ statusCode: 400, message: 'Slug manquant' }))
    expect(() => requireRouterParam(eventWith({ id: '' }), 'invitationId')).toThrowError(expect.objectContaining({ statusCode: 400, message: 'Paramètre manquant' }))
  })
})
