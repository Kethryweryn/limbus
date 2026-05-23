import { prisma } from '~/server/utils/prisma'

type CharacterLike = {
  id: string
  name: string
  type: string
  excludeFromTrombinoscope?: boolean | null
  trombinoscopeFaceHidden?: boolean | null
  trombinoscopePhotoUrl?: string | null
  trombinoscopeNote?: string | null
  trombinoscopeDisplayName?: string | null
  factions?: Array<{ id: string, name: string }>
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
  if (a.type !== b.type) return a.type === 'pj' ? -1 : 1
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
        const photoUrl = toPublicUrl(target.trombinoscopePhotoUrl || targetAssignment?.photoUrl || '', publicBaseUrl)
        const hidePhoto = target.trombinoscopeFaceHidden || !config.faceKnown
        const missingPhoto = !hidePhoto && !photoUrl
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
      .filter(Boolean) as Array<{
        target: CharacterLike
        displayName: string
        note: string
        photoUrl: string
        hidePhoto: boolean
        missingPhoto: boolean
      }>

    const html = renderTrombinoscopeHtml({
      sessionName: session.name,
      gameTitle: session.game.title,
      viewerName: viewer.name,
      entries: rows
    })

    await prisma.sessionTrombinoscope.upsert({
      where: {
        sessionId_viewerCharacterId_participantId: {
          sessionId,
          viewerCharacterId: viewer.id,
          participantId: assignment.participant.id
        }
      },
      update: {
        fileName: `${slugFilePart(session.name)}-${slugFilePart(viewer.name)}-trombinoscope.html`,
        contentHtml: html,
        missingPhotos: rows.filter((row) => row.missingPhoto).length,
        generatedAt: new Date()
      },
      create: {
        sessionId,
        viewerCharacterId: viewer.id,
        participantId: assignment.participant.id,
        fileName: `${slugFilePart(session.name)}-${slugFilePart(viewer.name)}-trombinoscope.html`,
        contentHtml: html,
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
  entries: Array<{
    target: CharacterLike
    displayName: string
    note: string
    photoUrl: string
    hidePhoto: boolean
    missingPhoto: boolean
  }>
}) {
  const cards = entries.map((entry) => {
    const image = entry.hidePhoto || entry.missingPhoto
      ? '<div class="unknown">?</div>'
      : `<img src="${escapeHtml(entry.photoUrl)}" alt="">`
    const tags = [
      entry.target.type === 'pnj' ? 'PNJ' : 'PJ',
      ...(entry.target.factions || []).map((faction) => faction.name)
    ]

    return `
      <article class="card">
        <div class="photo">${image}</div>
        <h2>${escapeHtml(entry.displayName)}</h2>
        <div class="tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
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
