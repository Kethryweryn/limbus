// Liens saisis par les organisateurs : seuls http(s) sont acceptés, jamais javascript: ni data:
export function isHttpUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

// Fichier téléversé dans Limbus, servi par une route qui vérifie les droits (ex. /api/uploads/session-payment-ribs/…)
export function isUploadUrl(value: string, prefix: string) {
  return value.startsWith(prefix) && /^[\w-]+\.[a-z]+$/.test(value.slice(prefix.length))
}

export const PHOTO_UPLOAD_PREFIX = '/api/uploads/session-assignment-photos/'
export const RIB_UPLOAD_PREFIX = '/api/uploads/session-payment-ribs/'

// Seules les vidéos YouTube sont intégrées dans la page : toute autre URL reste un simple lien
// Identifiant d'une vidéo YouTube, vérifié : seul lui sert à construire une adresse YouTube
export function youtubeVideoId(url: string | null | undefined) {
  if (!url || !isHttpUrl(url)) return null
  const { hostname, pathname, searchParams } = new URL(url)
  const host = hostname.replace(/^(www\.|m\.)/, '')
  const id = host === 'youtu.be'
    ? pathname.slice(1)
    : host === 'youtube.com'
      ? searchParams.get('v') || pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]
      : null
  return id && /^[\w-]{6,20}$/.test(id) ? id : null
}

export function youtubeEmbedUrl(url: string | null | undefined) {
  const id = youtubeVideoId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}
