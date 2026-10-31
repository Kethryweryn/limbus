import { findFormPeriod } from '~/server/utils/formRegistrations'
import { sendTeaserThumbnail } from '~/server/utils/teaserThumbnail'
import { youtubeVideoId } from '~/utils/urls'

// Vignette de l'aperçu du lien de diffusion sur les réseaux sociaux (US-084, R32) : celle du teaser YouTube du jeu
export default defineEventHandler(async (event) => {
  const period = await findFormPeriod(getRouterParam(event, 'publicId'))
  return await sendTeaserThumbnail(event, youtubeVideoId(period?.game.teaserUrl))
})
