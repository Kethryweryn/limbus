// Relecture de la page après l'envoi des modifications faites hors ligne, sans recharger l'application (US-255, R7) :
// jamais pendant une saisie ni dans une fenêtre ouverte

export type ActiveElement = { tagName: string, type?: string, isContentEditable?: boolean } | null | undefined

// Champs où l'on écrit ; un bouton, une case ou un lien qui a le focus ne retient pas la relecture
const NOT_TYPED = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'image', 'range', 'color'])

/** Un champ où l'on écrit a le focus. */
export function isTyping(element: ActiveElement) {
  if (!element) return false
  if (element.isContentEditable) return true
  const tag = element.tagName.toLowerCase()
  if (tag === 'textarea' || tag === 'select') return true
  return tag === 'input' && !NOT_TYPED.has((element.type ?? 'text').toLowerCase())
}

/** Relecture demandée, faite dès que rien n'est en cours : ni fenêtre ouverte, ni champ en cours de saisie. */
export class DeferredRefresh {
  private pending = false

  constructor(private busy: () => boolean, private run: () => void) {}

  /** Rend true si la relecture est faite tout de suite. */
  request() {
    if (this.busy()) {
      this.pending = true
      return false
    }
    this.pending = false
    this.run()
    return true
  }

  /** À appeler régulièrement : fait la relecture en attente si plus rien n'est en cours. */
  tick() {
    if (!this.pending || this.busy()) return false
    this.pending = false
    this.run()
    return true
  }

  /** La page a changé : elle a lu ses données en arrivant, la relecture en attente n'a plus lieu d'être. */
  cancel() {
    this.pending = false
  }

  get isPending() {
    return this.pending
  }
}
