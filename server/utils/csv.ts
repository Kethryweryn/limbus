// CSV pour un tableur français : séparateur point-virgule, BOM pour qu'Excel lise l'UTF-8
const SEPARATOR = ';'

// Une cellule qui commence par = + - @ serait exécutée comme formule par le tableur : on la neutralise
function csvCell(value: unknown) {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
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
