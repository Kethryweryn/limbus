const runningSends = new Set<string>()

/**
 * Un seul envoi d'emails à la fois par session : un double clic ou deux onglets
 * enverraient sinon deux fois aux mêmes destinataires, l'envoi n'étant noté qu'après coup.
 * Verrou en mémoire : suffisant tant que l'application tourne en un seul processus.
 */
export async function withSessionSendLock<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
  if (runningSends.has(sessionId)) {
    throw createError({ statusCode: 409, message: 'Un envoi est déjà en cours pour cette session. Attendez qu’il se termine.' })
  }

  runningSends.add(sessionId)
  try {
    return await task()
  } finally {
    runningSends.delete(sessionId)
  }
}
