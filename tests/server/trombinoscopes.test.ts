import { describe, expect, it } from 'vitest'
import { buildTrombinoscopeRows } from '~/server/utils/trombinoscopes'

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
