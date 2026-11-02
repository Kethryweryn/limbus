import { describe, expect, it, vi } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import { generateUniqueSlugs } from '~/server/utils/generateUniqueSlug'

// Slugs d'une copie de jeu (ADR-0025) : une requête par type d'élément, pas une par essai
describe('generateUniqueSlugs', () => {
  it('évite les slugs pris et ceux qu’il vient de donner, en une seule lecture', async () => {
    const findMany = vi.fn(async () => [{ slug: 'aube' }, { slug: 'aube-2' }, { slug: 'bran' }])
    Object.assign(prisma, { character: { findMany } })

    expect(await generateUniqueSlugs('character', ['Aube', 'Aube', 'Bran', 'Cael'])).toEqual(['aube-3', 'aube-4', 'bran-2', 'cael'])
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledWith({
      where: { OR: [{ slug: { startsWith: 'aube' } }, { slug: { startsWith: 'bran' } }, { slug: { startsWith: 'cael' } }] },
      select: { slug: true }
    })
  })

  it('ne lit rien sans élément', async () => {
    const findMany = vi.fn()
    Object.assign(prisma, { game: { findMany } })
    expect(await generateUniqueSlugs('game', [])).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})
