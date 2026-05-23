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

export const participantGameLinksInclude = {
  gameLinks: {
    orderBy: { createdAt: 'desc' as const },
    include: { game: true }
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


