// US-187 : rôles d'un document, conversion de l'ancien public et libellé (ADR-0072)
import { describe, expect, it } from 'vitest'
import { documentAudienceLabel, documentRoles, isDocumentTargeted, isEveryone, legacyAudience, rolesFromLegacyAudience } from '~/utils/documentAudiences'

const ALL = ['organizers', 'npcs', 'kitchen', 'pjs']

describe('public d’un document', () => {
  it('convertit l’ancien public en rôles, et les rôles en ancien public le plus proche', () => {
    expect(rolesFromLegacyAudience('everyone')).toEqual(ALL)
    expect(rolesFromLegacyAudience('npcs')).toEqual(['npcs'])
    expect(rolesFromLegacyAudience('targeted')).toEqual([])
    expect(rolesFromLegacyAudience(undefined)).toEqual([])

    expect(legacyAudience(['pjs', 'kitchen', 'npcs', 'organizers'])).toBe('everyone')
    expect(legacyAudience(['kitchen'])).toBe('kitchen')
    // Pas d'équivalent ancien : ciblage manuel
    expect(legacyAudience(['pjs'])).toBe('targeted')
    expect(legacyAudience(['npcs', 'kitchen'])).toBe('targeted')
  })

  it('se rabat sur l’ancien public : document gardé sur l’appareil ou écrit par le build d’avant', () => {
    expect(documentRoles({ audience: 'everyone' })).toEqual(ALL)
    expect(documentRoles({ audiences: [], audience: 'kitchen' })).toEqual(['kitchen'])
    expect(documentRoles({ audiences: ['pjs'], audience: 'targeted' })).toEqual(['pjs'])
    expect(documentAudienceLabel({ audience: 'npcs' })).toBe('PNJ')
    expect(isDocumentTargeted({ audience: 'targeted' })).toBe(false)
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
