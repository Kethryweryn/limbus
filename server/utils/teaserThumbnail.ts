import type { H3Event } from 'h3'
import { fetchPublicImage } from '~/server/utils/remoteImage'

// Cache en mémoire, borné : une page très vue, ou des appels en boucle, ne déclenchent pas une requête vers
// YouTube à chaque fois. Un échec est gardé aussi, moins longtemps.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FAILURE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX = 200
const cache = new Map<string, { image: Buffer | null, expiresAt: number }>()

export async function teaserThumbnail(videoId: string) {
  const cached = cache.get(videoId)
  if (cached && cached.expiresAt > Date.now()) return cached.image

  const fetched = await fetchPublicImage(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`)
  // Une vraie image JPEG seulement : rien d'autre n'est servi depuis cette route
  const image = fetched && fetched[0] === 0xff && fetched[1] === 0xd8 ? fetched : null
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
  cache.set(videoId, { image, expiresAt: Date.now() + (image ? CACHE_TTL_MS : FAILURE_TTL_MS) })
  return image
}

// Sert la vignette d'un teaser YouTube, ou 404 : jamais rien d'autre qu'une image JPEG vérifiée
export async function sendTeaserThumbnail(event: H3Event, videoId: string | null) {
  const image = videoId ? await teaserThumbnail(videoId) : null
  if (!image) {
    throw createError({ statusCode: 404, message: 'Vignette introuvable' })
  }
  setHeader(event, 'Content-Type', 'image/jpeg')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return image
}
