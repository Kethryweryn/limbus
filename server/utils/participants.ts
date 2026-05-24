type ParticipantWithGameLinks = {
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

export function participantGameLinksInclude(gameIds: string[] | null = null) {
  return {
    gameLinks: {
      where: gameIds === null ? undefined : { gameId: { in: gameIds } },
      orderBy: { createdAt: 'desc' as const },
      include: { game: true }
    }
  }
}

export function exposeParticipantGames<T extends ParticipantWithGameLinks>(participant: T) {
  const { gameLinks, ...rest } = participant
  return {
    ...rest,
    games: gameLinks?.map((link) => ({
      ...link.game,
      registeredAt: link.createdAt
    })) || []
  }
}

export function exposeParticipantsGames<T extends ParticipantWithGameLinks>(participants: T[]) {
  return participants.map(exposeParticipantGames)
}


