import { describe, expect, it } from 'vitest'
import { nameInGame } from '~/utils/participantNames'

// Nom d'une personne dans un jeu (SPEC-022 R6, ADR-0086)
describe('nameInGame', () => {
  const participant = { name: 'Nom de la fiche', gameNames: { 'jeu-a': 'Nom du jeu A', 'jeu-b': null } }
  it('donne le nom du jeu, sinon celui de la fiche', () => {
    expect(nameInGame(participant, 'jeu-a')).toBe('Nom du jeu A')
    expect(nameInGame(participant, 'jeu-b')).toBe('Nom de la fiche')
    expect(nameInGame(participant, null)).toBe('Nom de la fiche')
    expect(nameInGame({ name: 'Sans noms par jeu' }, 'jeu-a')).toBe('Sans noms par jeu')
  })
})
