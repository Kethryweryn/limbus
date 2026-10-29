import { prisma } from '~/server/utils/prisma'
import { fetchPublicImage } from '~/server/utils/remoteImage'
import { requireRouterParam } from '~/server/utils/routeParams'
import { youtubeVideoId } from '~/utils/urls'

// Cache en mémoire, borné : une page très vue, ou des appels en boucle, ne déclenchent pas une requête vers
// YouTube à chaque fois. Un échec est gardé aussi, moins longtemps.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FAILURE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX = 200
const cache = new Map<string, { image: Buffer | null, expiresAt: number }>()

async function thumbnailOf(videoId: string) {
  const cached = cache.get(videoId)
  if (cached && cached.expiresAt > Date.now()) return cached.image

  const fetched = await fetchPublicImage(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`)
  // Une vraie image JPEG seulement : rien d'autre n'est servi depuis cette route
  const image = fetched && fetched[0] === 0xff && fetched[1] === 0xd8 ? fetched : null
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
  cache.set(videoId, { image, expiresAt: Date.now() + (image ? CACHE_TTL_MS : FAILURE_TTL_MS) })
  return image
}

// Vignette du teaser YouTube d'une page publique (US-046) : Limbus la récupère lui-même, pour que la page ne
// charge rien depuis YouTube avant que la visiteuse lance la vidéo
export default defineEventHandler(async (event) => {
  const slug = requireRouterParam(event, 'slug')
  const game = await prisma.game.findFirst({
    where: { slug, published: true, publicPage: true },
    select: { teaserUrl: true }
  })
  const videoId = youtubeVideoId(game?.teaserUrl)
  if (!videoId) {
    throw createError({ statusCode: 404, message: 'Vignette introuvable' })
  }

  const image = await thumbnailOf(videoId)
  if (!image) {
    throw createError({ statusCode: 404, message: 'Vignette introuvable' })
  }

  setHeader(event, 'Content-Type', 'image/jpeg')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return image
})
