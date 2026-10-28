import { describe, expect, it } from 'vitest'
import { csvFilename, toCsv } from '~/server/utils/csv'

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

  it('laisse intact un numéro de téléphone international', () => {
    const lines = toCsv(['Téléphone'], [['+33 6 12 34 56 78'], ['+33612345678']]).split('\r\n')
    expect(lines.slice(1, 3)).toEqual(['+33 6 12 34 56 78', '+33612345678'])
  })

  it('nom de fichier sans accent ni caractère spécial', () => {
    expect(csvFilename('inscriptions-Été "spécial"/2027')).toBe('inscriptions-ete-special-2027.csv')
    expect(csvFilename('///')).toBe('export.csv')
  })
})
