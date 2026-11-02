// Appel à effet de bord lancé au montage d'une page (confirmation d'un lien à usage unique) : un remontage de la page
// reprend l'appel déjà lancé au lieu d'en envoyer un second, qui trouverait le lien déjà utilisé
const calls = new Map<string, Promise<unknown>>()

export function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  if (!calls.has(key)) calls.set(key, run())
  return calls.get(key) as Promise<T>
}
