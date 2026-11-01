import { prisma } from '~/server/utils/prisma'

// Rapports de la CSP en mode rapport (US-106, ADR-0053) : comptés par directive, ressource bloquée et page, sans
// adresse IP ni compte. Une URL peut porter un jeton (lien personnel) : on ne garde que l'origine de la ressource et
// le premier segment du chemin de la page

const MAX_DISTINCT_VIOLATIONS = 1000

function shortText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Origine d'une ressource bloquée, ou son mot-clé (inline, eval, data…). */
export function blockedSource(value: unknown) {
  const text = shortText(value, 500)
  if (!text) return 'inconnue'
  try {
    const url = new URL(text)
    return url.origin === 'null' ? `${url.protocol}` : url.origin
  } catch {
    return text.slice(0, 100)
  }
}

/** Page de la violation, réduite à son premier segment : /games/abc → /games/*. */
export function documentSection(value: unknown) {
  try {
    const segments = new URL(shortText(value, 2000)).pathname.split('/').filter(Boolean)
    if (!segments.length) return '/'
    return `/${segments[0]!.slice(0, 50)}${segments.length > 1 ? '/*' : ''}`
  } catch {
    return 'inconnue'
  }
}

/** Lit un rapport `application/csp-report` ; null s'il n'en est pas un. */
export function parseCspReport(raw: string | undefined) {
  if (!raw || raw.length > 20_000) return null
  try {
    const report = (JSON.parse(raw) as { 'csp-report'?: Record<string, unknown> })['csp-report']
    if (!report || typeof report !== 'object') return null
    const directive = shortText(report['effective-directive'] || report['violated-directive'], 200).split(' ')[0]!.slice(0, 100)
    if (!directive) return null
    return { directive, blockedUri: blockedSource(report['blocked-uri']), documentPath: documentSection(report['document-uri']) }
  } catch {
    return null
  }
}

export async function recordCspViolation(violation: { directive: string, blockedUri: string, documentPath: string }) {
  const key = { directive_blockedUri_documentPath: violation }
  const updated = await prisma.cspViolation.updateMany({ where: violation, data: { count: { increment: 1 }, lastSeenAt: new Date() } })
  if (updated.count) return
  // Une nouvelle violation n'entre que sous le plafond : un envoi abusif ne remplit pas la base
  if (await prisma.cspViolation.count() >= MAX_DISTINCT_VIOLATIONS) return
  await prisma.cspViolation.upsert({ where: key, update: { count: { increment: 1 }, lastSeenAt: new Date() }, create: violation })
}
