import { describe, expect, it } from 'vitest'
import { characterSheetContentHash, documentContentHash, isSentVersionOutdated } from '~/server/utils/documents'

const session = { name: 'Session', game: { title: 'Jeu' } }
const character = { name: 'Lea', pitch: null, background: 'Histoire', backgroundDocumentUrl: null, costumeIndications: null }

describe('version d’un envoi (US-030)', () => {
  it('l’empreinte change avec le contenu envoyé, et seulement lui', () => {
    const document = { title: 'Lettre', content: 'Texte', documentUrl: null }
    expect(documentContentHash(session, document)).toBe(documentContentHash(session, { ...document }))
    expect(documentContentHash(session, { ...document, content: 'Autre' })).not.toBe(documentContentHash(session, document))
    expect(characterSheetContentHash(session, { ...character, background: 'Corrigé' })).not.toBe(characterSheetContentHash(session, character))
  })

  it('dépassée si l’empreinte diffère ; sans empreinte, si la source a changé après l’envoi', () => {
    const sentAt = new Date('2026-10-01')
    expect(isSentVersionOutdated({ sentAt, contentHash: 'a' }, 'a', new Date('2026-10-02'))).toBe(false)
    expect(isSentVersionOutdated({ sentAt, contentHash: 'a' }, 'b', null)).toBe(true)
    expect(isSentVersionOutdated({ sentAt, contentHash: null }, 'b', new Date('2026-10-02'))).toBe(true)
    expect(isSentVersionOutdated({ sentAt, contentHash: null }, 'b', new Date('2026-09-30'))).toBe(false)
    expect(isSentVersionOutdated(null, 'b', new Date())).toBe(false)
  })
})
