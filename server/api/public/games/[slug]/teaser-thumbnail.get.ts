import { prisma } from '~/server/utils/prisma'
import { requireRouterParam } from '~/server/utils/routeParams'
import { sendTeaserThumbnail } from '~/server/utils/teaserThumbnail'
import { youtubeVideoId } from '~/utils/urls'

// Vignette du teaser YouTube d'une page publique (US-046) : Limbus la récupère lui-même, pour que la page ne
// charge rien depuis YouTube avant que la visiteuse lance la vidéo
export default defineEventHandler(async (event) => {
  const slug = requireRouterParam(event, 'slug')
  const game = await prisma.game.findFirst({
    where: { slug, published: true, publicPage: true },
    select: { teaserUrl: true }
  })
  return await sendTeaserThumbnail(event, youtubeVideoId(game?.teaserUrl))
})
