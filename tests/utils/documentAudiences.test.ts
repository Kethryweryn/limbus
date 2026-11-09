// US-187 : rôles d'un document et libellé (ADR-0072)
import { describe, expect, it } from 'vitest'
import { documentAudienceLabel, documentRoles, isDocumentTargeted, isEveryone, type DocumentRole } from '~/utils/documentAudiences'

const ALL: DocumentRole[] = ['organizers', 'npcs', 'kitchen', 'pjs']

describe('public d’un document', () => {
  it('lit les rôles cochés, et aucun sans liste', () => {
    expect(documentRoles({ audiences: ['pjs'] })).toEqual(['pjs'])
    expect(documentRoles({})).toEqual([])
    expect(isDocumentTargeted({})).toBe(false)
  })

  it('dit le public en clair, et « non ciblé » sans rien', () => {
    expect(isEveryone(ALL)).toBe(true)
    expect(documentAudienceLabel({ audiences: ALL })).toBe('Tout le monde')
    expect(documentAudienceLabel({ audiences: ['pjs', 'npcs'] })).toBe('PNJ · PJ')
    expect(documentAudienceLabel({ audiences: ['kitchen'], characters: [{}, {}], factions: [{}] })).toBe('Cuisine · 2 personnages · 1 groupe')
    expect(documentAudienceLabel({ audiences: [] })).toBe('Non ciblé')
    expect(isDocumentTargeted({ audiences: [], factions: [{}] })).toBe(true)
    expect(isDocumentTargeted({ audiences: [], characters: [] })).toBe(false)
  })
})
