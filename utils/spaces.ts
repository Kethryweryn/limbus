// Espaces « J'organise » / « Je participe » (US-073, ADR-0041) : le dernier utilisé est gardé sur l'appareil
export type Space = 'organize' | 'participate'

const STORAGE_KEY = 'limbusSpace'

export function spaceOfPath(path: string): Space {
  return path === '/participer' || path.startsWith('/participer/') ? 'participate' : 'organize'
}

export function rememberSpace(space: Space) {
  try {
    localStorage.setItem(STORAGE_KEY, space)
  } catch {
    // Stockage indisponible (navigation privée…) : l'espace se recalcule à l'ouverture
  }
}

function rememberedSpace(): Space | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'organize' || value === 'participate' ? value : null
  } catch {
    return null
  }
}

/**
 * Espace à rouvrir : le dernier utilisé sur cet appareil ; la première fois, « J'organise » si le compte
 * a un jeu à organiser, sinon « Je participe » (SPEC-011). Tout compte peut organiser : un choix d'organiser
 * est gardé même sans jeu encore.
 */
export function initialSpace(spaces: { organize: boolean, participate: boolean }, remembered: Space | null = rememberedSpace()): Space {
  return remembered ?? (spaces.organize ? 'organize' : 'participate')
}
