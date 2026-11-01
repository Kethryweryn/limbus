// Calcul du tirage au sort (US-093, ADR-0048), sans base ni horloge : la même graine et les mêmes entrées
// donnent le même résultat (R18). Le serveur prépare les entrées et enregistre le résultat dans le journal.

export type DrawCandidate = {
  registrationId: string
  // 2 pour une personne non tirée lors d'une autre période du jeu, si la pondération est active ; sinon 1
  weight: number
  // Valeur d'équilibre demandée ; null : peu importe
  preference: string | null
}

export type DrawSessionInput = {
  sessionId: string
  // Places encore libres (places moins retenues et confirmées)
  freeSeats: number
  // Places libres par valeur d'équilibre ; null sans équilibre
  reserves: Record<string, number> | null
  candidates: DrawCandidate[]
}

export type DrawSessionResult = {
  sessionId: string
  // Ordre du tirage de la session, avec le poids de chacune
  order: Array<{ registrationId: string, weight: number }>
  retained: string[]
  waitlisted: string[]
}

export type DrawResult = {
  sessions: DrawSessionResult[]
  rejected: string[]
}

// SHA-256 de la graine en quatre entiers, pour initialiser le générateur
async function seedWords(seed: string) {
  const digest = new Uint32Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)))
  return [digest[0]!, digest[1]!, digest[2]!, digest[3]!]
}

// sfc32 : générateur pseudo-aléatoire simple et reproductible, nombres dans [0, 1[
function sfc32(words: number[]) {
  let [a, b, c, d] = words as [number, number, number, number]
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

/**
 * Tirage pondéré sans remise (Efraimidis et Spirakis) : chaque candidate reçoit la clé u^(1/poids), on trie par clé
 * décroissante. Un poids 2 double les chances d'être devant une personne de poids 1 prise au hasard.
 */
function weightedOrder(candidates: DrawCandidate[], random: () => number) {
  return [...candidates]
    .sort((left, right) => left.registrationId.localeCompare(right.registrationId))
    .map((candidate) => ({ candidate, key: Math.pow(random(), 1 / candidate.weight) }))
    .sort((left, right) => right.key - left.key)
    .map(({ candidate }) => candidate)
}

// Place d'une personne : dans sa valeur ; « peu importe » ou une valeur inconnue prend la valeur la plus libre
function takeReservedSeat(reserves: Record<string, number>, preference: string | null) {
  if (preference !== null && preference in reserves) {
    if (reserves[preference]! <= 0) return false
    reserves[preference]! -= 1
    return true
  }
  const [freest] = Object.entries(reserves).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  if (!freest || freest[1] <= 0) return false
  reserves[freest[0]]! -= 1
  return true
}

/**
 * Tirage session par session, dans l'ordre donné (ADR-0048) : une personne placée dans une session ne l'est plus
 * dans les suivantes. Puis chaque session met en attente, dans son ordre, ses `waitlistSize` premières personnes
 * non placées ; une personne ni placée ni en attente est non retenue.
 */
export async function computeDraw(seed: string, sessions: DrawSessionInput[], waitlistSize: number): Promise<DrawResult> {
  const random = sfc32(await seedWords(seed))
  const placed = new Set<string>()
  const drawn = sessions.map((session) => {
    const order = weightedOrder(session.candidates.filter((candidate) => !placed.has(candidate.registrationId)), random)
    const reserves = session.reserves ? { ...session.reserves } : null
    const retained: string[] = []
    for (const candidate of order) {
      if (retained.length >= session.freeSeats) break
      if (reserves && !takeReservedSeat(reserves, candidate.preference)) continue
      retained.push(candidate.registrationId)
      placed.add(candidate.registrationId)
    }
    return { session, order, retained }
  })

  const waiting = new Set<string>()
  const results = drawn.map(({ session, order, retained }) => {
    const waitlisted = order
      .filter((candidate) => !placed.has(candidate.registrationId))
      .slice(0, Math.max(0, waitlistSize))
      .map((candidate) => candidate.registrationId)
    waitlisted.forEach((id) => waiting.add(id))
    return {
      sessionId: session.sessionId,
      order: order.map(({ registrationId, weight }) => ({ registrationId, weight })),
      retained,
      waitlisted
    }
  })

  const everyone = [...new Set(sessions.flatMap((session) => session.candidates.map((candidate) => candidate.registrationId)))].sort()
  return { sessions: results, rejected: everyone.filter((id) => !placed.has(id) && !waiting.has(id)) }
}

/**
 * Places d'une session par valeur d'équilibre (R17) : au prorata des personnages PJ qui portent chaque valeur,
 * par la méthode des plus forts restes, moins les places déjà prises par des personnes de cette valeur.
 * Une place prise par « peu importe » est retirée de la valeur la plus libre. null : pas de PJ qui porte une valeur.
 */
export function balanceReserves(seats: number, characterValues: Record<string, number>, takenPreferences: Array<string | null>) {
  const values = Object.keys(characterValues).filter((value) => characterValues[value]! > 0).sort()
  const total = values.reduce((sum, value) => sum + characterValues[value]!, 0)
  if (!total) return null
  const shares = values.map((value) => ({ value, exact: (seats * characterValues[value]!) / total }))
  const reserves: Record<string, number> = Object.fromEntries(shares.map(({ value, exact }) => [value, Math.floor(exact)]))
  let left = seats - Object.values(reserves).reduce((sum, count) => sum + count, 0)
  for (const { value } of [...shares].sort((a, b) => (b.exact % 1) - (a.exact % 1) || a.value.localeCompare(b.value))) {
    if (left <= 0) break
    reserves[value]! += 1
    left -= 1
  }
  for (const preference of takenPreferences) takeReservedSeat(reserves, preference)
  return reserves
}
