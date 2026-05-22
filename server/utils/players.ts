type PlayerWithGameLinks = {
  gameLinks?: Array<{
    createdAt: Date
    game: {
      id: string
      title: string
      slug: string
      description: string
      noteIntention: string | null
      teaserUrl: string | null
      createdAt: Date
      updatedAt: Date
      published: boolean
    }
  }>
}

export const playerGameLinksInclude = {
  gameLinks: {
    orderBy: { createdAt: 'desc' as const },
    include: { game: true }
  }
}

export function exposePlayerGames<T extends PlayerWithGameLinks>(player: T) {
  const { gameLinks, ...rest } = player
  return {
    ...rest,
    games: gameLinks?.map((link) => ({
      ...link.game,
      registeredAt: link.createdAt
    })) || []
  }
}

export function exposePlayersGames<T extends PlayerWithGameLinks>(players: T[]) {
  return players.map(exposePlayerGames)
}
