// CSV pour un tableur français : séparateur point-virgule, BOM pour qu'Excel lise l'UTF-8
const SEPARATOR = ';'

// Une cellule qui commence par = + - @ (même après des espaces) serait exécutée comme formule par le tableur :
// on la neutralise
const FORMULA_START = /^\s*[=+\-@]|^[\t\r]/

/** Valeur à garder en texte dans le tableur, comme un téléphone « +33612345678 » qu'Excel lirait comme un nombre. */
export class CsvText {
  constructor(readonly text: string) {}
}

/** Téléphone d'un export (SPEC-023 R6) : sa forme rangée, gardée en texte. */
export const csvPhone = (phone: string | null | undefined) => phone ? new CsvText(phone) : null

function csvCell(value: unknown) {
  // Texte forcé par une formule qui ne fait que rendre sa chaîne : ses guillemets sont doublés, elle n'en sort pas
  if (value instanceof CsvText) return `"=""${value.text.replace(/"/g, '""""')}"""`
  let text = value == null ? '' : String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
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
