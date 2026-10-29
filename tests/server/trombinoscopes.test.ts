import { describe, expect, it } from 'vitest'
import { buildTrombinoscopeRows, isTrombinoscopeOutdated, trombinoscopeFingerprint } from '~/server/utils/trombinoscopes'

const character = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, type: 'pj', factions: [], ...extra })
const noEntries = new Map()

describe('photo d’une entrée (US-026)', () => {
  const viewer = character('viewer')

  it('prend la photo de la personne qui joue le rôle avant la photo par défaut', () => {
    const [row] = buildTrombinoscopeRows(viewer, [character('lea', { trombinoscopePhotoUrl: '/defaut.jpg' })], noEntries, new Map([['lea', { photoUrl: '/session.jpg' }]]))
    expect(row).toMatchObject({ photoUrl: '/session.jpg', missingPhoto: false })
  })

  it('se replie sur la photo par défaut, sinon compte une photo manquante', () => {
    const rows = buildTrombinoscopeRows(viewer, [character('lea', { trombinoscopePhotoUrl: '/defaut.jpg' }), character('noe')], noEntries, new Map([['lea', { photoUrl: null }]]))
    expect(rows.map((row) => [row.target.id, row.photoUrl, row.missingPhoto])).toEqual([['lea', '/defaut.jpg', false], ['noe', '', true]])
  })

  it('le visage caché ou inconnu l’emporte sur les deux photos', () => {
    const entries = new Map([['viewer:noe', { included: true, faceKnown: false }]])
    const rows = buildTrombinoscopeRows(viewer, [character('lea', { trombinoscopeFaceHidden: true }), character('noe')], entries, new Map([['lea', { photoUrl: '/a.jpg' }], ['noe', { photoUrl: '/b.jpg' }]]))
    expect(rows.map((row) => [row.hidePhoto, row.missingPhoto])).toEqual([[true, false], [true, false]])
  })
})

describe('soi-même (US-027)', () => {
  it('le personnage qui regarde n’est jamais une entrée, même inclus par un ancien réglage', () => {
    const viewer = character('viewer')
    const entries = new Map([['viewer:viewer', { included: true, faceKnown: true }]])
    expect(buildTrombinoscopeRows(viewer, [viewer, character('lea')], entries, new Map()).map((row) => row.target.id)).toEqual(['lea'])
  })
})

describe('empreinte d’un trombinoscope (US-028)', () => {
  const viewer = character('viewer')
  const fingerprint = (target: Record<string, unknown>, photoUrl: string | null = null) => trombinoscopeFingerprint({
    gameTitle: 'Jeu',
    sessionName: 'Session',
    viewerName: 'viewer',
    rows: buildTrombinoscopeRows(viewer, [character('lea', target)], noEntries, new Map([['lea', { photoUrl }]]))
  })

  it('est stable, et change avec une photo, un nom affiché ou un visage caché', () => {
    const base = fingerprint({})
    expect(fingerprint({})).toBe(base)
    expect(fingerprint({}, '/photo.jpg')).not.toBe(base)
    expect(fingerprint({ trombinoscopeDisplayName: 'Le Masque' })).not.toBe(base)
    expect(fingerprint({ trombinoscopeFaceHidden: true })).not.toBe(base)
  })

  it('un trombinoscope sans empreinte ou d’empreinte différente est périmé', () => {
    const fingerprints = new Map([['viewer:p1', 'abc']])
    expect(isTrombinoscopeOutdated({ viewerCharacterId: 'viewer', participantId: 'p1', sourceHash: 'abc' }, fingerprints)).toBe(false)
    expect(isTrombinoscopeOutdated({ viewerCharacterId: 'viewer', participantId: 'p1', sourceHash: 'def' }, fingerprints)).toBe(true)
    expect(isTrombinoscopeOutdated({ viewerCharacterId: 'viewer', participantId: 'p1', sourceHash: null }, fingerprints)).toBe(true)
  })
})
