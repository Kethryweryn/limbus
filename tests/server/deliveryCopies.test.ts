// EPIC-018 : copies des envois (US-078) et leur effacement après la session (US-080)
import { describe, expect, it } from 'vitest'
import { copiesExpireAt, copyData, imageContentType, textCopy } from '~/server/utils/deliveryCopies'

const DAY = 24 * 60 * 60 * 1000
const at = (iso: string) => new Date(iso)
const session = (id: string, data: Partial<{ date: Date | null, status: string, cancelledAt: Date | null, postponedToSessionId: string | null }> = {}) =>
  ({ id, date: null, status: 'scheduled', cancelledAt: null, postponedToSessionId: null, ...data })

describe('date d’effacement des copies (US-080)', () => {
  it('le lendemain de la session ; jamais pour une session sans date', () => {
    const dated = session('a', { date: at('2026-11-14T09:00:00Z') })
    expect(copiesExpireAt(dated, new Map())).toEqual(new Date(at('2026-11-14T09:00:00Z').getTime() + DAY))
    expect(copiesExpireAt(session('b'), new Map())).toBeNull()
    expect(copiesExpireAt(session('c', { status: 'completed', date: at('2026-11-14T09:00:00Z') }), new Map())).not.toBeNull()
  })

  it('une session reportée suit celle qui la remplace, jusqu’à la dernière', () => {
    const last = session('c', { date: at('2027-03-01T09:00:00Z') })
    const middle = session('b', { status: 'postponed', postponedToSessionId: 'c' })
    const first = session('a', { status: 'postponed', date: at('2026-11-14T09:00:00Z'), postponedToSessionId: 'b' })
    const byId = new Map([first, middle, last].map((item) => [item.id, item]))
    expect(copiesExpireAt(first, byId)).toEqual(new Date(at('2027-03-01T09:00:00Z').getTime() + DAY))
    // Session de remplacement introuvable : on garde
    expect(copiesExpireAt(first, new Map())).toBeNull()
  })

  it('une session annulée garde ses copies un mois après l’annulation', () => {
    const cancelled = session('a', { status: 'cancelled', date: at('2026-11-14T09:00:00Z'), cancelledAt: at('2026-10-30T10:00:00Z') })
    expect(copiesExpireAt(cancelled, new Map())).toEqual(at('2026-11-30T10:00:00Z'))
    expect(copiesExpireAt(session('b', { status: 'cancelled' }), new Map())).toBeNull()
  })
})

describe('contenu d’une copie (US-078)', () => {
  it('garde le PDF, ce qui se lit dans la page, et leur taille', () => {
    const pdf = new Uint8Array([1, 2, 3])
    const copy = textCopy({ title: 'Lettre', subtitle: 'Session', sections: [{ title: 'Contenu', body: 'Bonjour' }] }, pdf)
    const data = copyData(copy)
    expect(data.copyContent).toEqual({ kind: 'text', title: 'Lettre', subtitle: 'Session', sections: [{ title: 'Contenu', body: 'Bonjour' }] })
    expect(data.copySize).toBe(3 + Buffer.byteLength(JSON.stringify(data.copyContent)))
    expect(copyData(undefined)).toEqual({})
  })

  it('ne sert que des images reconnues', () => {
    expect(imageContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png')
    expect(imageContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(imageContentType(Buffer.from('RIFF0000WEBPVP8 '))).toBe('image/webp')
    expect(imageContentType(Buffer.from('<svg onload=alert(1)>'))).toBeNull()
  })
})
