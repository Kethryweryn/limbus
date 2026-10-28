// CSV pour un tableur français : séparateur point-virgule, BOM pour qu'Excel lise l'UTF-8
const SEPARATOR = ';'

// Une cellule qui commence par = + - @ (même après des espaces) serait exécutée comme formule par le tableur :
// on la neutralise. Un numéro de téléphone international (+33 6…) n'est qu'un nombre : il reste tel quel.
const FORMULA_START = /^\s*[=+\-@]|^[\t\r]/
const PHONE_NUMBER = /^\+[\d\s().-]+$/

function csvCell(value: unknown) {
  let text = value == null ? '' : String(value)
  if (FORMULA_START.test(text) && !PHONE_NUMBER.test(text)) text = `'${text}`
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: string[], rows: unknown[][]) {
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(SEPARATOR)).join('\r\n') + '\r\n'
}

// Nom de fichier sûr pour Content-Disposition : lettres, chiffres et tirets
export function csvFilename(base: string) {
  const slug = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  return `${slug || 'export'}.csv`
}
