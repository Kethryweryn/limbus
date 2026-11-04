// Prévision du questionnaire de casting avant les réponses (SPEC-016, R5 à R10, ADR-0062) : fonctions pures. La simulation
// tourne dans un Web Worker (questionnaireForecast.worker.ts) ; les phrases sont rédigées par questionnaireForecastText.ts
import type { CastingLink } from './castingAssistant'
import {
  assignmentRatios,
  demandCounts,
  linkedQuestions,
  noteOf,
  optionsOf,
  QUESTIONNAIRE_THRESHOLDS,
  tiedCount,
  worstLevel,
  type QualityCharacter,
  type QualityLevel,
  type QualityQuestion
} from './questionnaireQuality'
import { quantile, shannonEntropy } from './statistics'

export const FORECAST_RUNS = 1000
// Fourchette qui contient 95 % des simulations (ADR-0062)
const RANGE_LOW = 0.025
const RANGE_HIGH = 0.975

export type OptionExpectation = { questionId: string, option: string, share: number }
export type ForecastInput = { questions: QualityQuestion[], links: CastingLink[], characters: QualityCharacter[], expectations: OptionExpectation[] }

/** Les parts indiquées pour une question, ou null sans parts utilisables : la question suit alors la répartition par défaut (R6). */
function givenShares(question: QualityQuestion, expectations: OptionExpectation[]) {
  const options = optionsOf(question)
  const rows = expectations.filter((row) => row.questionId === question.id && options.includes(row.option))
  // Un choix unique ou une échelle sans part positive (son formulaire a changé) n'a pas de répartition à suivre
  if (!rows.length || (question.type !== 'multiple' && rows.every((row) => !row.share))) return null
  return new Map(rows.map((row) => [row.option, row.share]))
}

/** Pour chaque option : la chance d'être choisie (somme de 1), ou d'être cochée pour une question à choix multiples (R6). */
export function answerProbabilities(question: QualityQuestion, expectations: OptionExpectation[]) {
  const options = optionsOf(question)
  const shares = givenShares(question, expectations)
  if (question.type === 'multiple') return options.map((option) => (shares ? shares.get(option) ?? 0 : 0.5))
  if (!shares) return options.map(() => 1 / options.length)
  const total = [...shares.values()].reduce((sum, share) => sum + share, 0)
  return options.map((option) => (shares.get(option) ?? 0) / total)
}

// Les profils de réponses que distingue une question : options de mêmes liens confondues pour un choix unique. expected est
// l'information attendue avec les parts de l'équipe, null sans parts
function questionInformation(question: QualityQuestion, links: CastingLink[], expectations: OptionExpectation[]) {
  const options = optionsOf(question)
  const mine = links.filter((link) => link.questionId === question.id)
  const probabilities = answerProbabilities(question, expectations)
  const hasShares = givenShares(question, expectations) !== null

  if (question.type === 'multiple') {
    const linked = options.flatMap((option, index) => (mine.some((link) => link.option === option) ? [probabilities[index]!] : []))
    const expected = linked.reduce((sum, probability) => sum + shannonEntropy([probability, 1 - probability]), 0)
    return { profiles: 2 ** linked.length, bits: linked.length, expected: hasShares ? expected : null }
  }
  if (question.type === 'scale') {
    return { profiles: options.length, bits: Math.log2(options.length), expected: hasShares ? shannonEntropy(probabilities) : null }
  }
  const groups = new Map<string, number>()
  options.forEach((option, index) => {
    const signature = mine.filter((link) => link.option === option).map(({ target }) => `${target.kind}:${target.id}`).sort().join('\u0000')
    groups.set(signature, (groups.get(signature) ?? 0) + probabilities[index]!)
  })
  return { profiles: groups.size, bits: Math.log2(groups.size), expected: hasShares ? shannonEntropy([...groups.values()]) : null }
}

/** R5 : ce que les questions reliées peuvent distinguer, comparé au nombre de personnages. Condition nécessaire, pas suffisante. */
export function maximalInformation({ questions, links, characters, expectations }: ForecastInput) {
  const measured = linkedQuestions(questions, links).map((question) => ({
    id: question.id,
    label: question.label,
    ...questionInformation(question, links, expectations)
  }))
  const profiles = measured.reduce((product, { profiles }) => product * profiles, 1)
  return {
    level: (profiles < characters.length ? 'review' : 'good') as QualityLevel,
    profiles,
    bits: measured.reduce((sum, { bits }) => sum + bits, 0),
    requiredBits: Math.log2(characters.length),
    characterCount: characters.length,
    questions: measured.map(({ id, label, bits, expected }) => ({ id, label, bits, expected }))
  }
}

// L'ordre des liens et des personnages de même nom n'est pas garanti par la base : le calcul et l'empreinte le fixent (R10)
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
function canonical({ questions, links, characters, expectations }: ForecastInput): ForecastInput {
  const linkKey = ({ questionId, option, target }: CastingLink) => [questionId, option, target.kind, target.id].join('\u0000')
  return {
    questions,
    links: [...links].sort((a, b) => byText(linkKey(a), linkKey(b))),
    characters: [...characters].sort((a, b) => byText(a.id, b.id)),
    expectations: [...expectations].sort((a, b) => byText(`${a.questionId}\u0000${a.option}`, `${b.questionId}\u0000${b.option}`))
  }
}

// Empreinte FNV-1a de la forme du questionnaire, sans libellés ni noms : corriger une faute ne change pas la prévision
function fingerprint({ questions, links, characters, expectations }: ForecastInput) {
  const ids = (list: Array<{ id: string }>) => list.map(({ id }) => id).sort()
  const text = JSON.stringify([
    questions.map(({ id, type, options }) => [id, type, options]),
    links.map(({ questionId, option, target }) => [questionId, option, target.kind, target.id]),
    characters.map(({ id, factions, intrigues }) => [id, ids(factions), ids(intrigues)]),
    expectations.map(({ questionId, option, share }) => [questionId, option, share])
  ])
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  }
  return hash >>> 0
}

// Générateur pseudo-aléatoire à graine (mulberry32), entre 0 et 1
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

// Une question reliée, prête à tirer : les points de chaque réponse possible par personnage, calculés une fois par castingScore.
// Une note est une somme de points par lien : les additionner donne la note de l'assistant, sans le recalculer 3,6 millions de fois
type PreparedQuestion = { multiple: boolean, points: number[][], probabilities: number[] }

export function prepareQuestion(question: QualityQuestion, links: CastingLink[], characters: QualityCharacter[], expectations: OptionExpectation[]): PreparedQuestion {
  const mine = links.filter((link) => link.questionId === question.id)
  const castings = characters.map((character) => ({ ...character, relations: [] }))
  const answers = optionsOf(question).map((option) => {
    if (question.type === 'scale') return Number(option)
    return question.type === 'multiple' ? [option] : option
  })
  return {
    multiple: question.type === 'multiple',
    points: answers.map((answer) => castings.map((casting) => noteOf(casting, { [question.id]: answer }, [question], mine))),
    probabilities: answerProbabilities(question, expectations)
  }
}

/** Notes d'une personne fictive pour chaque personnage (R7). */
function drawPerson(prepared: PreparedQuestion[], characterCount: number, random: () => number) {
  const notes = new Array<number>(characterCount).fill(0)
  const add = (points: number[]) => points.forEach((value, index) => {
    notes[index]! += value
  })
  for (const { multiple, points, probabilities } of prepared) {
    if (multiple) {
      probabilities.forEach((probability, index) => {
        if (random() < probability) add(points[index]!)
      })
      continue
    }
    // Une réponse sans aucune chance n'est jamais tirée, même si la somme des parts s'arrête juste sous 1
    let chosen = probabilities.findLastIndex((probability) => probability > 0)
    let reached = 0
    const drawn = random()
    for (const [index, probability] of probabilities.entries()) {
      reached += probability
      if (drawn < reached) {
        chosen = index
        break
      }
    }
    add(points[chosen]!)
  }
  return notes
}

const summary = (values: number[]) => {
  const sorted = Float64Array.from(values).sort()
  return { median: quantile(sorted, 0.5), lower: quantile(sorted, RANGE_LOW), upper: quantile(sorted, RANGE_HIGH) }
}

/** R7 à R9 : 1 000 inscriptions fictives, passées par les calculs de SPEC-015 ; les seuils s'appliquent à la médiane. */
export function simulateRegistrations(input: ForecastInput, runs = FORECAST_RUNS) {
  const { questions, links, characters, expectations } = canonical(input)
  const count = characters.length
  const prepared = linkedQuestions(questions, links).map((question) => prepareQuestion(question, links, characters, expectations))
  const random = seededRandom(fingerprint({ questions, links, characters, expectations }))
  const { estimateGood, estimateReview, tiedShare, rarelyWanted, overWanted } = QUESTIONNAIRE_THRESHOLDS

  const inTop = characters.map(() => [] as number[])
  const best = characters.map(() => [] as number[])
  const noteValues: number[] = []
  const tieShares: number[] = []
  for (let run = 0; run < runs; run++) {
    const notes = Array.from({ length: count }, () => drawPerson(prepared, count, random))
    const demand = demandCounts(notes, count)
    demand.inTop.forEach((value, index) => inTop[index]!.push(value))
    demand.best.forEach((value, index) => best[index]!.push(value))
    const { ratios } = assignmentRatios(notes, count)
    if (ratios.length) noteValues.push(ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length)
    tieShares.push(tiedCount(notes) / count)
  }

  const noteLevel = (value: number): QualityLevel => {
    if (value >= estimateGood) return 'good'
    return value >= estimateReview ? 'watch' : 'review'
  }
  const noteSummary = noteValues.length ? summary(noteValues) : null
  const tiesSummary = summary(tieShares)

  // Un personnage sans lien a déjà son repère « à revoir » (SPEC-015, R4)
  const reached = characters.flatMap((character, index) => (prepared.some(({ points }) => points.some((row) => row[index]! > 0)) ? [{ character, index }] : []))
  const shareOf = (values: number[], hit: (value: number) => boolean) => values.filter(hit).length / values.length
  const demand = reached.flatMap(({ character, index }) => {
    const named = { id: character.id, name: character.name }
    const top = summary(inTop[index]!).median
    const first = summary(best[index]!).median
    return [
      ...(top < rarelyWanted ? [{ kind: 'rarelyWanted' as const, character: named, median: top, share: shareOf(inTop[index]!, (value) => value < rarelyWanted) }] : []),
      ...(first > overWanted ? [{ kind: 'overWanted' as const, character: named, median: first, share: shareOf(best[index]!, (value) => value > overWanted) }] : [])
    ]
  }).sort((a, b) => b.share - a.share || a.character.name.localeCompare(b.character.name, 'fr'))

  return {
    people: count,
    runs,
    note: noteSummary && { level: noteLevel(noteSummary.median), ...noteSummary },
    ties: { level: (tiesSummary.median <= tiedShare ? 'good' : 'review') as QualityLevel, ...tiesSummary },
    demand
  }
}

/** Toute la prévision d'un questionnaire qui a au moins une question reliée et un personnage. */
export function runForecast(input: ForecastInput, runs = FORECAST_RUNS) {
  const information = maximalInformation(input)
  const simulation = simulateRegistrations(input, runs)
  const linked = linkedQuestions(input.questions, input.links)
  return {
    level: worstLevel([
      information.level,
      simulation.ties.level,
      ...(simulation.note ? [simulation.note.level] : []),
      ...(simulation.demand.length ? ['watch' as const] : [])
    ]),
    information,
    simulation,
    linkedCount: linked.length,
    withShares: linked.filter((question) => givenShares(question, input.expectations)).length
  }
}

export type QuestionnaireForecast = ReturnType<typeof runForecast>
