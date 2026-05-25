import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont } from 'pdf-lib'
import slugify from 'slugify'

type TextPdfSection = {
  title?: string
  body?: string | null
}

type TextPdfInput = {
  title: string
  subtitle?: string | null
  sections: TextPdfSection[]
}

export function generatedPdfFileName(parts: Array<string | null | undefined>) {
  const name = parts
    .filter(Boolean)
    .map((part) => slugify(String(part), { lower: true, strict: true }))
    .filter(Boolean)
    .join('-')

  return `${name || 'document'}.pdf`
}

export async function renderTextPdf(input: TextPdfInput) {
  const pdf = await PDFDocument.create()
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pageSize: [number, number] = [595.28, 841.89]
  const margin = 54
  const fontSize = 11
  const titleSize = 20
  const sectionTitleSize = 13
  const lineHeight = 16
  const sectionGap = 14
  const maxWidth = pageSize[0] - margin * 2
  let page = pdf.addPage(pageSize)
  let y = pageSize[1] - margin

  const ensureSpace = (height: number) => {
    if (y - height >= margin) return
    page = pdf.addPage(pageSize)
    y = pageSize[1] - margin
  }

  const drawLine = (text: string, size = fontSize, bold = false, color = rgb(0.12, 0.16, 0.22)) => {
    ensureSpace(lineHeight)
    page.drawText(pdfSafeText(text), {
      x: margin,
      y,
      size,
      font: bold ? boldFont : regularFont,
      color
    })
    y -= lineHeight
  }

  drawLine(input.title, titleSize, true)
  if (input.subtitle) {
    drawLine(input.subtitle, fontSize, false, rgb(0.35, 0.4, 0.48))
  }
  y -= sectionGap

  for (const section of input.sections) {
    if (section.title) {
      ensureSpace(sectionTitleSize + lineHeight)
      drawLine(section.title, sectionTitleSize, true)
    }

    const paragraphs = (section.body || '').split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
    if (!paragraphs.length) {
      drawLine('Aucun contenu renseigné.', fontSize, false, rgb(0.45, 0.5, 0.57))
    }

    for (const paragraph of paragraphs) {
      const lines = wrapPdfText(paragraph, regularFont, fontSize, maxWidth)
      for (const line of lines) {
        drawLine(line)
      }
      y -= 4
    }
    y -= sectionGap
  }

  return await pdf.save()
}

function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = pdfSafeText(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
      continue
    }

    if (line) lines.push(line)
    line = word
  }

  if (line) lines.push(line)
  return lines
}

function pdfSafeText(value: string) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/[^\x20-\xFF]/g, '')
}
