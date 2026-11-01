// Assistant de casting (US-101, US-102, ADR-0051) : notes tirées du questionnaire, interdits et proposition de répartition
import { characterRelationTypeLabel, REFUSED_RELATION_NONE } from './characterRelations'

export type CastingQuestion = { id: string, label: string, type: string }
export type CastingLink = { questionId: string, option: string, target: { kind: string, id: string, name: string } }
export type CastingCharacter = {
  id: string
  name: string
  factions: Array<{ id: string, name: string }>
  intrigues: Array<{ id: string, name: string }>
  relations: Array<{ otherId: string, otherName: string, type: string }>
}
export type CastingPlayer = {
  id: string
  name: string
  answers: Record<string, unknown>
  refusedTypes: string[]
  notWithIds: string[]
}
export type CastingScore = { score: number, components: Array<{ label: string, points: number }> }

// Poids d'un lien selon ce qu'il vise : le personnage lui-même, ou sa faction ou son intrigue (R27)
const DIRECT_WEIGHT = 1
const GROUP_WEIGHT = 0.5

/** Part d'une réponse pour une option reliée : 1 si l'option est choisie ; pour une échelle de 1 à 5, (n − 1) / 4. */
export function answerFactor(question: CastingQuestion, option: string, answer: unknown) {
  if (question.type === 'scale') {
    return typeof answer === 'number' ? Math.min(Math.max((answer - 1) / 4, 0), 1) : 0
  }
  if (Array.isArray(answer)) return answer.includes(option) ? 1 : 0
  return answer === option ? 1 : 0
}

function linkWeight(link: CastingLink, character: CastingCharacter) {
  if (link.target.kind === 'character') return link.target.id === character.id ? { weight: DIRECT_WEIGHT, label: character.name } : null
  const groups = link.target.kind === 'faction' ? character.factions : link.target.kind === 'intrigue' ? character.intrigues : []
  if (!groups.some((group) => group.id === link.target.id)) return null
  return { weight: GROUP_WEIGHT, label: `${link.target.kind === 'faction' ? 'faction' : 'intrigue'} ${link.target.name}` }
}

/** Note d'un joueur pour un personnage, avec chaque réponse qui y contribue (R27). */
export function castingScore(player: CastingPlayer, character: CastingCharacter, questions: CastingQuestion[], links: CastingLink[]): CastingScore {
  const questionsById = new Map(questions.map((question) => [question.id, question]))
  const components: CastingScore['components'] = []
  for (const link of links) {
    const question = questionsById.get(link.questionId)
    const target = question && linkWeight(link, character)
    if (!question || !target) continue
    const answer = player.answers[question.id]
    const factor = answerFactor(question, link.option, answer)
    if (!factor) continue
    const given = question.type === 'scale' ? `${answer}/5` : link.option
    components.push({ label: `« ${question.label} » : ${given} → ${target.label}`, points: factor * target.weight })
  }
  return { score: components.reduce((sum, component) => sum + component.points, 0), components }
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Paires de joueurs dont l'un ne veut pas jouer avec l'autre (affinité rattachée, dans un sens ou dans l'autre). */
export function notWithPairs(players: CastingPlayer[]) {
  const pairs = new Set<string>()
  for (const player of players) {
    for (const otherId of player.notWithIds) {
      if (otherId !== player.id) pairs.add(pairKey(player.id, otherId))
    }
  }
  return pairs
}

/** Relations d'un type que le joueur refuse : le personnage lui est interdit (R28). */
export function refusedRelationBlocks(player: CastingPlayer, character: CastingCharacter) {
  const refused = new Set(player.refusedTypes.filter((type) => type !== REFUSED_RELATION_NONE))
  return character.relations
    .filter((relation) => refused.has(relation.type))
    .map((relation) => `Relation refusée : ${characterRelationTypeLabel(relation.type)}, avec ${relation.otherName}`)
}

type Holders = Map<string, string>

// Personne en conflit avec ce joueur s'il prenait ce personnage : un personnage en relation directe est tenu par quelqu'un
// avec qui l'un des deux ne veut pas jouer
function conflictWith(playerId: string, character: CastingCharacter, holders: Holders, pairs: Set<string>) {
  for (const relation of character.relations) {
    const holder = holders.get(relation.otherId)
    if (holder && holder !== playerId && pairs.has(pairKey(playerId, holder))) return { characterName: relation.otherName, holderId: holder }
  }
  return null
}

/**
 * Affectation de coût minimal (méthode hongroise, O(n³)) sur une matrice carrée. Renvoie, pour chaque ligne, sa colonne.
 */
export function hungarian(cost: number[][]) {
  const n = cost.length
  const u = new Array<number>(n + 1).fill(0)
  const v = new Array<number>(n + 1).fill(0)
  const p = new Array<number>(n + 1).fill(0)
  const way = new Array<number>(n + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array<number>(n + 1).fill(Infinity)
    const used = new Array<boolean>(n + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]!
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue
        const current = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!
        if (current < minv[j]!) {
          minv[j] = current
          way[j] = j0
        }
        if (minv[j]! < delta) {
          delta = minv[j]!
          j1 = j
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!]! += delta
          v[j]! -= delta
        } else {
          minv[j]! -= delta
        }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]!
      p[j0] = p[j1]!
      j0 = j1
    } while (j0)
  }
  const rowToColumn = new Array<number>(n).fill(-1)
  for (let j = 1; j <= n; j++) {
    if (p[j]) rowToColumn[p[j]! - 1] = j - 1
  }
  return rowToColumn
}

export type CastingInput = {
  players: CastingPlayer[]
  characters: CastingCharacter[]
  questions: CastingQuestion[]
  links: CastingLink[]
  /** Lignes verrouillées : personnage → joueur (null : la ligne reste vide). */
  locked: Map<string, string | null>
}

export type CastingPair = CastingScore & { characterId: string, blocks: string[] }

export function castingAssistant({ players, characters, questions, links, locked }: CastingInput) {
  const pairs = notWithPairs(players)
  const names = new Map(players.map((player) => [player.id, player.name]))
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  const lockedHolders: Holders = new Map([...locked].filter((entry): entry is [string, string] => Boolean(entry[1])))
  const lockedPlayerIds = new Set(lockedHolders.values())

  // Note et interdits de chaque paire ; « ne veut pas jouer avec » n'interdit ici que face aux lignes verrouillées
  const byPlayer = new Map(players.map((player) => [player.id, characters.map((character): CastingPair => {
    const blocks = refusedRelationBlocks(player, character)
    const conflict = conflictWith(player.id, character, lockedHolders, pairs)
    if (conflict) blocks.push(`Relation directe avec ${conflict.characterName}, joué par ${names.get(conflict.holderId) ?? '?'} : l'un ne veut pas jouer avec l'autre`)
    return { characterId: character.id, ...castingScore(player, character, questions, links), blocks }
  })]))
  const pairIndex = new Map([...byPlayer].map(([playerId, list]) => [playerId, new Map(list.map((pair) => [pair.characterId, pair]))]))
  const pairOf = (playerId: string, characterId: string) => pairIndex.get(playerId)?.get(characterId)
  const allowed = (playerId: string, characterId: string) => pairOf(playerId, characterId)?.blocks.length === 0
  const scoreOf = (playerId: string, characterId: string) => pairOf(playerId, characterId)?.score ?? 0

  // Affectation optimale des joueurs libres sur les personnages libres. Coûts : d'abord placer le plus de monde,
  // ensuite la meilleure note ; une paire interdite n'est jamais choisie
  const freePlayers = players.filter((player) => !lockedPlayerIds.has(player.id))
  const freeCharacters = characters.filter((character) => !locked.has(character.id))
  const size = Math.max(freePlayers.length, freeCharacters.length)
  const maxScore = Math.max(0, ...freePlayers.flatMap((player) => freeCharacters.map((character) => scoreOf(player.id, character.id))))
  const empty = (maxScore + 1) * (size + 1)
  const forbidden = empty * (size + 1) * 2
  const cost = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => {
    const player = freePlayers[row]
    const character = freeCharacters[column]
    if (!player || !character) return empty
    return allowed(player.id, character.id) ? maxScore - scoreOf(player.id, character.id) : forbidden
  }))
  const holders: Holders = new Map(lockedHolders)
  hungarian(cost).forEach((column, row) => {
    const player = freePlayers[row]
    const character = freeCharacters[column]
    if (player && character && allowed(player.id, character.id)) holders.set(character.id, player.id)
  })

  // Conflits « ne veut pas jouer avec » restants : déplacer ou échanger l'un des deux au moindre coût, sinon le retirer
  const characterOf = () => new Map([...holders].map(([characterId, playerId]) => [playerId, characterId]))
  // Le joueur peut-il tenir ce personnage dans la répartition envisagée, échange compris
  const fits = (playerId: string, characterId: string, next: Holders) =>
    allowed(playerId, characterId) && !conflictWith(playerId, charactersById.get(characterId)!, next, pairs)
  for (let guard = 0; guard < players.length * 2; guard++) {
    const held = characterOf()
    const conflict = [...holders].find(([characterId, playerId]) => !lockedPlayerIds.has(playerId) && conflictWith(playerId, charactersById.get(characterId)!, holders, pairs))
    if (!conflict) break
    const [characterId, playerId] = conflict
    const other = conflictWith(playerId, charactersById.get(characterId)!, holders, pairs)!.holderId
    const movers = [playerId, other].filter((id) => !lockedPlayerIds.has(id))
    let best: { delta: number, apply: () => void } | null = null
    for (const mover of movers) {
      const current = held.get(mover)!
      const consider = (delta: number, apply: () => void) => {
        if (!best || delta > best.delta) best = { delta, apply }
      }
      // Retirer coûte plus que n'importe quel déplacement : on garde le plus de monde placé
      consider(-scoreOf(mover, current) - 2 * maxScore - 1, () => holders.delete(current))
      for (const character of freeCharacters) {
        const holder = holders.get(character.id)
        if (holder === mover || (holder && lockedPlayerIds.has(holder))) continue
        const next = new Map(holders)
        if (holder) next.set(current, holder)
        else next.delete(current)
        next.set(character.id, mover)
        if (!fits(mover, character.id, next) || (holder && !fits(holder, current, next))) continue
        const delta = scoreOf(mover, character.id) - scoreOf(mover, current) + (holder ? scoreOf(holder, current) - scoreOf(holder, character.id) : 0)
        consider(delta, () => {
          holders.clear()
          for (const [characterId, playerId] of next) holders.set(characterId, playerId)
        })
      }
    }
    (best as { apply: () => void } | null)?.apply()
  }

  const held = characterOf()
  const proposal = characters.map((character) => {
    const playerId = holders.get(character.id) ?? null
    const pair = playerId ? pairOf(playerId, character.id) : null
    return { characterId: character.id, playerId, locked: locked.has(character.id), score: pair?.score ?? 0, components: pair?.components ?? [] }
  })
  const unplaced = freePlayers.filter((player) => !held.has(player.id)).map((player) => ({
    playerId: player.id,
    reason: freeCharacters.some((character) => allowed(player.id, character.id))
      ? 'Plus de personnage libre qui lui convienne sans conflit'
      : 'Tous les personnages libres lui sont interdits'
  }))
  // Conflits entre lignes verrouillées : l'assistant ne les défait pas, il les signale
  const lockedConflicts = [...lockedHolders].flatMap(([characterId, playerId]) => {
    const conflict = conflictWith(playerId, charactersById.get(characterId)!, lockedHolders, pairs)
    return conflict && playerId < conflict.holderId
      ? [`${names.get(playerId) ?? '?'} (${charactersById.get(characterId)!.name}) et ${names.get(conflict.holderId) ?? '?'} (${conflict.characterName}) : relation directe, alors que l'un ne veut pas jouer avec l'autre`]
      : []
  })

  return {
    pairs: Object.fromEntries([...byPlayer].map(([playerId, list]) => [playerId, [...list].sort((a, b) => b.score - a.score)])),
    proposal,
    unplaced,
    lockedConflicts
  }
}
