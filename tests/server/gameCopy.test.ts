import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GAME_COPY_FIELDS } from '~/server/utils/gameCopy'
import { gameCreditText } from '~/utils/games'

// Champs (scalaires et relations) de chaque modèle du schéma Prisma
function schemaFields() {
  const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8')
  const models = new Map<string, string[]>()
  for (const [, name, body] of schema.matchAll(/^model (\w+) \{\r?\n([\s\S]*?)^\}/gm)) {
    models.set(name!, body!.split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//') && !line.startsWith('@@'))
      .map((line) => line.split(/\s+/)[0]!))
  }
  return models
}

describe('copie d’un jeu', () => {
  it('classe chaque champ des modèles copiés : copié, remplacé, relié ou laissé', () => {
    const models = schemaFields()
    for (const [model, fields] of Object.entries(GAME_COPY_FIELDS)) {
      const classified = [...fields.copied, ...fields.remapped, ...fields.relinked, ...fields.omitted]
      expect(new Set(classified).size, `${model} : champ classé deux fois`).toBe(classified.length)
      expect([...classified].sort(), `${model} : champs à classer dans GAME_COPY_FIELDS`).toEqual([...models.get(model)!].sort())
    }
  })

  it('formule le crédit de la copie', () => {
    expect(gameCreditText({ creditSourceTitle: 'Les Brumes', creditAuthorName: 'Alice' })).toBe('D’après « Les Brumes », de Alice')
    expect(gameCreditText({ creditSourceTitle: 'Les Brumes', creditAuthorName: null })).toBe('D’après « Les Brumes »')
    expect(gameCreditText({ creditSourceTitle: null, creditAuthorName: 'Alice' })).toBeNull()
  })
})
