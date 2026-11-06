// Espaces « J'organise » / « Je participe » (US-073, ADR-0041) : le dernier utilisé est gardé sur l'appareil
export type Space = 'organize' | 'participate'

const STORAGE_KEY = 'limbusSpace'

export function spaceOfPath(path: string): Space {
  return path === '/participer' || path.startsWith('/participer/') ? 'participate' : 'organize'
}

// Le choix est gardé avec son compte : celui d'une autre personne sur le même appareil ne s'applique pas
export function rememberSpace(space: Space, userId: string | undefined) {
  if (!userId) return
  try {
    localStorage.setItem(STORAGE_KEY, `${userId}:${space}`)
  } catch {
    // Stockage indisponible (navigation privée…) : l'espace se recalcule à l'ouverture
  }
}

export function forgetSpace() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Stockage indisponible : rien à oublier
  }
}

function rememberedSpace(userId: string | undefined): Space | null {
  try {
    const [owner, value] = (localStorage.getItem(STORAGE_KEY) ?? '').split(':')
    return owner === userId && (value === 'organize' || value === 'participate') ? value : null
  } catch {
    return null
  }
}

/**
 * Espace à rouvrir : le dernier utilisé sur cet appareil ; la première fois, « J'organise » si le compte
 * a un jeu à organiser, sinon « Je participe » (SPEC-011). Tout compte peut organiser : un choix d'organiser
 * est gardé même sans jeu encore.
 */
export function initialSpace(spaces: { organize: boolean, participate: boolean }, userId?: string, remembered: Space | null = rememberedSpace(userId)): Space {
  return remembered ?? (spaces.organize ? 'organize' : 'participate')
}

// Le sélecteur sert à qui organise et participe. Une personne qui ne fait que participer ne le voit que si elle se
// trouve côté organisation : sans lui, elle n'aurait aucun moyen de revenir à ses participations.
export function showsSpaceSelector(spaces: { organize: boolean, participate: boolean } | undefined, current: Space) {
  return Boolean(spaces?.participate && (spaces.organize || current === 'organize'))
}
