import type { Ref } from 'vue'

/**
 * Bouton d'envoi tenu désactivé un instant après un envoi (US-029), pour qu'un double clic ne renvoie pas : la cible
 * prend `value`, puis revient à `reset` si rien ne l'a changée entre-temps.
 */
export function coolDown<T>(target: Ref<T>, value: T, reset: T, ms = 1500) {
  target.value = value
  window.setTimeout(() => {
    if (target.value === value) target.value = reset
  }, ms)
}
