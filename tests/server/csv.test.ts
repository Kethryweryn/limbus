import { describe, expect, it } from 'vitest'
import { csvFilename, csvPhone, toCsv } from '~/server/utils/csv'

const BOM = '﻿'

describe('export CSV', () => {
  it('séparateur point-virgule, BOM, guillemets doublés', () => {
    const csv = toCsv(['Nom', 'Email'], [['Zoé "Z" ; Martin', null]])
    expect(csv).toBe(`${BOM}Nom;Email\r\n"Zoé ""Z"" ; Martin";\r\n`)
  })

  it('neutralise les cellules qu’un tableur prendrait pour une formule', () => {
    const lines = toCsv(['A'], [['=HYPERLINK("x")'], [' =1+1'], ['+1+cmd'], ['-1'], ['@SUM']]).split('\r\n')
    expect(lines.slice(1, 6)).toEqual([`"'=HYPERLINK(""x"")"`, `' =1+1`, `'+1+cmd`, `'-1`, `'@SUM`])
  })

  it('garde un téléphone en texte, que le tableur ne lise pas comme un nombre (SPEC-023, R6)', () => {
    const lines = toCsv(['Téléphone'], [[csvPhone('+33612345678')], [csvPhone(null)], [csvPhone('a"b')], ['+33612345678']]).split('\r\n')
    // Cellule ="+33612345678", puis guillemets doublés pour le CSV ; une chaîne qui n'est pas un téléphone reste neutralisée
    expect(lines.slice(1, 5)).toEqual(['"=""+33612345678"""', '', '"=""a""""b"""', `'+33612345678`])
  })

  it('nom de fichier sans accent ni caractère spécial', () => {
    expect(csvFilename('inscriptions-Été "spécial"/2027')).toBe('inscriptions-ete-special-2027.csv')
    expect(csvFilename('///')).toBe('export.csv')
  })
})
