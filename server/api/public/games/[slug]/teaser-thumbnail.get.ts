import { prisma } from '~/server/utils/prisma'
import { fetchPublicImage } from '~/server/utils/remoteImage'
import { requireRouterParam } from '~/server/utils/routeParams'
import { youtubeVideoId } from '~/utils/urls'

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

  const image = await fetchPublicImage(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`)
  // Une vraie image JPEG seulement : rien d'autre n'est servi depuis cette route
  if (!image || image[0] !== 0xff || image[1] !== 0xd8) {
    throw createError({ statusCode: 404, message: 'Vignette introuvable' })
  }

  setHeader(event, 'Content-Type', 'image/jpeg')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return image
})
