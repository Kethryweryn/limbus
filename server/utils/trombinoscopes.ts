import { prisma } from '~/server/utils/prisma'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { CHARACTER_TYPES } from '~/utils/domain'

type CharacterLike = {
  id: string
  name: string
  type: string
  excludeFromTrombinoscope?: boolean | null
  trombinoscopeFaceHidden?: boolean | null
  trombinoscopePhotoUrl?: string | null
  trombinoscopeNote?: string | null
  trombinoscopeDisplayName?: string | null
  factions?: Array<{ id: string, name: string, showInTrombinoscope?: boolean | null }>
}

type TrombinoscopeRow = {
  target: CharacterLike
  displayName: string
  note: string
  photoUrl: string
  hidePhoto: boolean
  missingPhoto: boolean
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function slugFilePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'trombinoscope'
}

function characterSort(a: CharacterLike, b: CharacterLike) {
  if (a.type !== b.type) return a.type === CHARACTER_TYPES.pj ? -1 : 1
  return a.name.localeCompare(b.name)
}

function getEntryDefaults(target: CharacterLike, entry?: {
  included: boolean
  faceKnown: boolean
  displayName?: string | null
  note?: string | null
}) {
  const globallyHidden = Boolean(target.trombinoscopeFaceHidden)

  return {
    included: entry?.included ?? !target.excludeFromTrombinoscope,
    faceKnown: globallyHidden ? false : (entry?.faceKnown ?? true),
    displayName: entry?.displayName || target.trombinoscopeDisplayName || target.name,
    note: entry?.note || target.trombinoscopeNote || ''
  }
}

export async function getCharacterTrombinoscopeConfig(viewerCharacterId: string) {
  const viewer = await prisma.character.findUnique({
    where: { id: viewerCharacterId },
    include: { game: true }
  })

  if (!viewer) {
    throw createError({ statusCode: 404, statusMessage: 'Personnage introuvable' })
  }

  const [characters, entries] = await Promise.all([
    prisma.character.findMany({
      where: { gameId: viewer.gameId },
      include: { factions: { orderBy: { name: 'asc' } } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    }),
    prisma.characterTrombinoscopeEntry.findMany({
      where: { viewerCharacterId }
    })
  ])

  const entriesByTargetId = new Map(entries.map((entry) => [entry.targetCharacterId, entry]))

  return {
    viewer,
    characters: characters.sort(characterSort).map((target) => ({
      ...target,
      trombinoscope: getEntryDefaults(target, entriesByTargetId.get(target.id))
    }))
  }
}

export async function saveCharacterTrombinoscopeConfig(
  viewerCharacterId: string,
  entries: Array<{
    targetCharacterId: string
    included: boolean
    faceKnown: boolean
    displayName?: string | null
    note?: string | null
  }>
) {
  const viewer = await prisma.character.findUnique({
    where: { id: viewerCharacterId },
    select: { gameId: true }
  })

  if (!viewer) {
    throw createError({ statusCode: 404, statusMessage: 'Personnage introuvable' })
  }

  const targetIds = [...new Set(entries.map((entry) => entry.targetCharacterId))]
  const matchingCharacters = await prisma.character.count({
    where: { id: { in: targetIds }, gameId: viewer.gameId }
  })

  if (matchingCharacters !== targetIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Personnages invalides pour ce jeu' })
  }

  for (const entry of entries) {
    await prisma.characterTrombinoscopeEntry.upsert({
      where: {
        viewerCharacterId_targetCharacterId: {
          viewerCharacterId,
          targetCharacterId: entry.targetCharacterId
        }
      },
      update: {
        included: entry.included,
        faceKnown: entry.faceKnown,
        displayName: entry.displayName,
        note: entry.note
      },
      create: {
        viewerCharacterId,
        targetCharacterId: entry.targetCharacterId,
        included: entry.included,
        faceKnown: entry.faceKnown,
        displayName: entry.displayName,
        note: entry.note
      }
    })
  }

  return await getCharacterTrombinoscopeConfig(viewerCharacterId)
}

export async function generateSessionTrombinoscopes(sessionId: string, publicBaseUrl = '') {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      game: true,
      assignments: {
        include: {
          participant: true,
          character: {
            include: { factions: { orderBy: { name: 'asc' } } }
          }
        }
      }
    }
  })

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session introuvable' })
  }

  const [characters, entries] = await Promise.all([
    prisma.character.findMany({
      where: { gameId: session.gameId },
      include: { factions: { orderBy: { name: 'asc' } } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    }),
    prisma.characterTrombinoscopeEntry.findMany({
      where: { viewerCharacter: { gameId: session.gameId } }
    })
  ])

  const castByCharacterId = new Map(
    session.assignments.map((assignment) => [assignment.characterId, assignment])
  )
  const entriesByViewerAndTarget = new Map(
    entries.map((entry) => [`${entry.viewerCharacterId}:${entry.targetCharacterId}`, entry])
  )

  let generatedCount = 0
  let missingPhotosCount = 0

  for (const assignment of session.assignments) {
    if (!assignment.participantId || !assignment.participant) continue

    const viewer = assignment.character
    const rows = characters
      .sort(characterSort)
      .map((target) => {
        const entry = entriesByViewerAndTarget.get(`${viewer.id}:${target.id}`)
        const config = getEntryDefaults(target, entry)
        if (!config.included || target.excludeFromTrombinoscope) return null

        const targetAssignment = castByCharacterId.get(target.id)
        const sourcePhotoUrl = target.trombinoscopePhotoUrl || targetAssignment?.photoUrl || ''
        const photoUrl = sourcePhotoUrl.startsWith('/api/uploads/session-assignment-photos/')
          ? sourcePhotoUrl
          : toPublicUrl(sourcePhotoUrl, publicBaseUrl)
        const hidePhoto = target.trombinoscopeFaceHidden || !config.faceKnown
        const missingPhoto = !hidePhoto && !sourcePhotoUrl
        if (missingPhoto) missingPhotosCount++

        return {
          target,
          displayName: config.displayName,
          note: config.note,
          photoUrl,
          hidePhoto,
          missingPhoto
        }
      })
      .filter(Boolean) as TrombinoscopeRow[]

    const html = renderTrombinoscopeHtml({
      sessionName: session.name,
      gameTitle: session.game.title,
      viewerName: viewer.name,
      entries: rows
    })
    const pdfBytes = await renderTrombinoscopePdf({
      sessionName: session.name,
      gameTitle: session.game.title,
      viewerName: viewer.name,
      entries: rows
    })
    const fileName = `${slugFilePart(session.name)}-${slugFilePart(viewer.name)}-trombinoscope.pdf`

    await prisma.sessionTrombinoscope.upsert({
      where: {
        sessionId_viewerCharacterId_participantId: {
          sessionId,
          viewerCharacterId: viewer.id,
          participantId: assignment.participant.id
        }
      },
      update: {
        fileName,
        contentHtml: html,
        contentPdfBase64: Buffer.from(pdfBytes).toString('base64'),
        missingPhotos: rows.filter((row) => row.missingPhoto).length,
        generatedAt: new Date()
      },
      create: {
        sessionId,
        viewerCharacterId: viewer.id,
        participantId: assignment.participant.id,
        fileName,
        contentHtml: html,
        contentPdfBase64: Buffer.from(pdfBytes).toString('base64'),
        missingPhotos: rows.filter((row) => row.missingPhoto).length
      }
    })

    generatedCount++
  }

  return { generatedCount, missingPhotosCount }
}

export async function getSessionTrombinoscope(sessionId: string, characterId: string) {
  const trombinoscope = await prisma.sessionTrombinoscope.findFirst({
    where: {
      sessionId,
      viewerCharacterId: characterId
    }
  })

  if (!trombinoscope) {
    throw createError({ statusCode: 404, statusMessage: 'Trombinoscope introuvable' })
  }

  return trombinoscope
}

function renderTrombinoscopeHtml({
  sessionName,
  gameTitle,
  viewerName,
  entries
}: {
  sessionName: string
  gameTitle: string
  viewerName: string
  entries: TrombinoscopeRow[]
}) {
  const cards = entries.map((entry) => {
    const image = entry.hidePhoto || entry.missingPhoto
      ? '<div class="unknown">?</div>'
      : `<img src="${escapeHtml(entry.photoUrl)}" alt="">`
    const tags = (entry.target.factions || [])
      .filter((faction) => faction.showInTrombinoscope)
      .map((faction) => faction.name)

    return `
      <article class="card">
        <div class="photo">${image}</div>
        <h2>${escapeHtml(entry.displayName)}</h2>
        ${tags.length ? `<div class="tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
      </article>
    `
  }).join('')

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(gameTitle)} - Trombinoscope ${escapeHtml(viewerName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; font-family: Inter, Arial, sans-serif; color: #111827; background: #f8fafc; }
    header { margin-bottom: 28px; }
    .eyebrow { color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
    h1 { margin: 6px 0; font-size: 30px; }
    .subtitle { color: #475569; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 18px; }
    .card { break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #fff; }
    .photo { aspect-ratio: 3 / 4; border-radius: 10px; overflow: hidden; background: #e5e7eb; display: grid; place-items: center; }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .unknown { width: 100%; height: 100%; display: grid; place-items: center; font-size: 72px; font-weight: 800; color: #64748b; background: linear-gradient(135deg, #f1f5f9, #cbd5e1); }
    h2 { margin: 12px 0 8px; font-size: 18px; line-height: 1.2; }
    .tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
    .tags span { border: 1px solid #cbd5e1; border-radius: 999px; padding: 2px 8px; font-size: 11px; color: #475569; }
    p { margin: 0; color: #475569; font-size: 13px; line-height: 1.45; white-space: pre-line; }
    @media print {
      body { background: #fff; padding: 18mm; }
      .card { box-shadow: none; }
    }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">${escapeHtml(gameTitle)}</div>
    <h1>Trombinoscope de ${escapeHtml(viewerName)}</h1>
    <div class="subtitle">${escapeHtml(sessionName)}</div>
  </header>
  <main class="grid">${cards}</main>
</body>
</html>`
}

function toPublicUrl(value: string, publicBaseUrl: string) {
  if (!value || !publicBaseUrl || !value.startsWith('/')) return value
  return `${publicBaseUrl.replace(/\/$/, '')}${value}`
}

async function renderTrombinoscopePdf({
  sessionName,
  gameTitle,
  viewerName,
  entries
}: {
  sessionName: string
  gameTitle: string
  viewerName: string
  entries: TrombinoscopeRow[]
}) {
  const pdf = await PDFDocument.create()
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pageSize: [number, number] = [595.28, 841.89]
  const margin = 36
  const gap = 14
  const cardWidth = (pageSize[0] - margin * 2 - gap * 2) / 3
  const cardHeight = 246
  const photoHeight = 132
  let page = pdf.addPage(pageSize)
  let y = pageSize[1] - margin
  let x = margin
  let column = 0

  const drawHeader = () => {
    page.drawText(pdfSafeText(gameTitle.toUpperCase()), {
      x: margin,
      y,
      size: 9,
      font: boldFont,
      color: rgb(0.39, 0.45, 0.55)
    })
    y -= 20
    page.drawText(pdfSafeText(`Trombinoscope de ${viewerName}`), {
      x: margin,
      y,
      size: 22,
      font: boldFont,
      color: rgb(0.07, 0.09, 0.15)
    })
    y -= 18
    page.drawText(pdfSafeText(sessionName), {
      x: margin,
      y,
      size: 10,
      font: regularFont,
      color: rgb(0.29, 0.33, 0.41)
    })
    y -= 28
  }

  drawHeader()

  for (const entry of entries) {
    if (y - cardHeight < margin) {
      page = pdf.addPage(pageSize)
      y = pageSize[1] - margin
      x = margin
      column = 0
      drawHeader()
    }

    const top = y
    page.drawRectangle({
      x,
      y: top - cardHeight,
      width: cardWidth,
      height: cardHeight,
      borderColor: rgb(0.88, 0.91, 0.94),
      borderWidth: 1,
      color: rgb(1, 1, 1)
    })

    const imageBox = {
      x: x + 10,
      y: top - 10 - photoHeight,
      width: cardWidth - 20,
      height: photoHeight
    }
    await drawPhoto(pdf, page, entry, imageBox, boldFont)

    let textY = imageBox.y - 16
    textY = drawWrappedText(page, entry.displayName, x + 10, textY, cardWidth - 20, {
      font: boldFont,
      size: 12,
      lineHeight: 14,
      color: rgb(0.07, 0.09, 0.15),
      maxLines: 2
    })

    const tagText = (entry.target.factions || [])
      .filter((faction) => faction.showInTrombinoscope)
      .map((faction) => faction.name)
      .join(' · ')
    if (tagText) {
      textY = drawWrappedText(page, tagText, x + 10, textY - 4, cardWidth - 20, {
        font: regularFont,
        size: 8,
        lineHeight: 10,
        color: rgb(0.39, 0.45, 0.55),
        maxLines: 2
      })
    }

    if (entry.note) {
      drawWrappedText(page, entry.note, x + 10, textY - 6, cardWidth - 20, {
        font: regularFont,
        size: 8,
        lineHeight: 10,
        color: rgb(0.29, 0.33, 0.41),
        maxLines: 5
      })
    }

    column++
    if (column === 3) {
      column = 0
      x = margin
      y -= cardHeight + gap
    } else {
      x += cardWidth + gap
    }
  }

  return await pdf.save()
}

async function drawPhoto(pdf: PDFDocument, page: any, entry: TrombinoscopeRow, box: {
  x: number
  y: number
  width: number
  height: number
}, boldFont: any) {
  page.drawRectangle({
    ...box,
    color: rgb(0.9, 0.93, 0.96)
  })

  if (entry.hidePhoto || entry.missingPhoto) {
    page.drawText('?', {
      x: box.x + box.width / 2 - 18,
      y: box.y + box.height / 2 - 24,
      size: 60,
      font: boldFont,
      color: rgb(0.39, 0.45, 0.55)
    })
    return
  }

  const imageBytes = await loadImageBytes(entry.photoUrl)
  if (!imageBytes) {
    page.drawText('?', {
      x: box.x + box.width / 2 - 18,
      y: box.y + box.height / 2 - 24,
      size: 60,
      font: boldFont,
      color: rgb(0.39, 0.45, 0.55)
    })
    return
  }

  try {
    const image = isPng(imageBytes)
      ? await pdf.embedPng(imageBytes)
      : await pdf.embedJpg(imageBytes)
    const scale = Math.min(box.width / image.width, box.height / image.height)
    const width = image.width * scale
    const height = image.height * scale
    page.drawImage(image, {
      x: box.x + (box.width - width) / 2,
      y: box.y + (box.height - height) / 2,
      width,
      height
    })
  } catch {
    page.drawText('?', {
      x: box.x + box.width / 2 - 18,
      y: box.y + box.height / 2 - 24,
      size: 60,
      font: boldFont,
      color: rgb(0.39, 0.45, 0.55)
    })
  }
}

async function loadImageBytes(photoUrl: string) {
  try {
    if (photoUrl.startsWith('/api/uploads/session-assignment-photos/')) {
      const filename = basename(photoUrl)
      return await readFile(join(process.cwd(), '.data', 'uploads', 'session-assignment-photos', filename))
    }

    if (/^https?:\/\//.test(photoUrl)) {
      const response = await fetch(photoUrl)
      if (!response.ok) return null
      return Buffer.from(await response.arrayBuffer())
    }
  } catch {
    return null
  }

  return null
}

function isPng(bytes: Uint8Array) {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
}

function drawWrappedText(page: any, text: string, x: number, y: number, maxWidth: number, options: {
  font: any
  size: number
  lineHeight: number
  color: ReturnType<typeof rgb>
  maxLines: number
}) {
  const words = pdfSafeText(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word
    if (options.font.widthOfTextAtSize(nextLine, options.size) <= maxWidth) {
      line = nextLine
    } else {
      if (line) lines.push(line)
      line = word
    }

    if (lines.length >= options.maxLines) break
  }

  if (line && lines.length < options.maxLines) lines.push(line)

  lines.forEach((lineText, index) => {
    page.drawText(lineText, {
      x,
      y: y - index * options.lineHeight,
      size: options.size,
      font: options.font,
      color: options.color
    })
  })

  return y - lines.length * options.lineHeight
}

function pdfSafeText(value: string) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
}
