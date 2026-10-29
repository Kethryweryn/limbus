import { expect, test } from '@playwright/test'

test('un teaser YouTube ne charge le lecteur qu’au clic (US-046)', async ({ page }) => {
  const youtubeRequests: string[] = []
  page.on('request', (request) => {
    if (/youtube|ytimg|googlevideo/.test(new URL(request.url()).hostname)) youtubeRequests.push(request.url())
  })
  await page.goto('/public/games/jeu-teaser')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('iframe')).toHaveCount(0)
  expect(youtubeRequests).toEqual([])

  await page.getByRole('button', { name: 'Lire la vidéo (YouTube)' }).click()
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1')
})

test('un teaser javascript: n’est ni intégré ni proposé en lien', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss() })

  await page.goto('/public/games/jeu-piege')
  await expect(page.getByRole('heading', { name: 'Jeu piégé' })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByText('Voir le teaser')).toHaveCount(0)
  expect(dialogs).toEqual([])
})
