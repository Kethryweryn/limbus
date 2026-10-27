import { expect, test } from '@playwright/test'

test('un teaser YouTube est intégré sur la page publique', async ({ page }) => {
  await page.goto('/public/games/jeu-teaser')
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ')
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
