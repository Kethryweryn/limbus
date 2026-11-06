// Qualité du questionnaire de casting (SPEC-015, ADR-0061) : repères calculés à partir du formulaire et des liens.
// Fonctions pures, partagées entre la route et les tests ; les phrases sont rédigées par l'interface.
import { castingScore, optimalAssignment, type CastingCharacter, type CastingLink, type CastingQuestion } from './castingAssistant'
import { REGISTRATION_CHOICE_TYPES, type RegistrationQuestionType } from './registrationForms'
import { contingency, FISHER_MIN_N, fisherTest, holmAdjust, leikDispersion, noncentralChiSquareSurvival, normalizedEntropy, pearson, spearman, wilsonInterval } from './statistics'

export type QualityLevel = 'good' | 'watch' | 'review' | 'unsure'
export type QualityQuestion = CastingQuestion & { type: RegistrationQuestionType, options: string[] }
export type QualityCharacter = Pick<CastingCharacter, 'id' | 'name' | 'factions' | 'intrigues'>

// Seuils des repères (ADR-0061) : en changer un est un changement de comportement, qui passe par la spec
export const QUESTIONNAIRE_THRESHOLDS = {
  // R6 : similarité cosinus à partir de laquelle deux personnages sont indistincts (« 8 points sur 10 en commun »)
  indistinctSimilarity: 0.8,
  // R8 : part d'une même réponse à partir de laquelle une question ne départage pas
  dominantShare: 0.8,
  // R9 : part d'une extrémité dans une répartition égale entre les 5 notes (ADR-0063)
  scaleEndShare: 0.2,
  // R10 : seuil « fort » de Cohen, à diviser par √df* pour le V de Cramér ; limite haute de Clark et Watson entre échelles
  duplicateCramer: 0.5,
  duplicateScales: 0.5,
  // R11 : seuil prudent du critère HTMT
  indistinctNotes: 0.85,
  // R12 : les 3 meilleurs personnages ; peu demandé sous 2 personnes, disputé au-delà de 3
  topCharacters: 3,
  rarelyWanted: 2,
  overWanted: 3,
  // R13 : note moyenne dans l'affectation optimale ; part des personnes à égalité en tête (ADR-0064)
  estimateGood: 0.75,
  estimateReview: 0.6,
  tiedShare: 0.5,
  // Valeurs p unilatérales : même conclusion que la borne d'un intervalle à 95 % (ADR-0063)
  alpha: 0.025
} as const

type Named = { id: string, name: string }
type QuestionRef = { questionId: string, questionLabel: string }
type QuestionName = { id: string, label: string }
// Une réponse, mesurée sur les personnes qui ont répondu ; dominantAnswer donne en plus l'entropie (choix unique, échelle)
// ou la part de chaque option (choix multiple)
type AnswerMeasure = QuestionRef & {
  level: 'review' | 'unsure'
  option: string
  count: number
  total: number
  share: number
  lower: number
  threshold: number
  ignored: number
}

export type QuestionnaireFinding =
  | { kind: 'characterWithoutLink', level: 'review', character: Named }
  | { kind: 'questionWithoutLink', level: 'watch' } & QuestionRef
  | { kind: 'optionWithoutLink', level: 'watch', option: string } & QuestionRef
  | {
    kind: 'indistinctCharacters'
    level: 'review'
    characters: [Named, Named]
    similarity: number
    threshold: number
    // Réponse qui sépare le plus les deux personnages, et celui qu'elle favorise ; null si aucune ne les sépare
    separating: { questionLabel: string, option: string, favors: Named } | null
  }
  | { kind: 'dominantAnswer', questionType: RegistrationQuestionType, entropy: number | null, shares: Array<{ option: string, share: number }> | null } & AnswerMeasure
  | { kind: 'scaleEnd', leik: number } & AnswerMeasure
  | {
    kind: 'duplicateQuestions'
    level: 'review' | 'unsure'
    questions: [QuestionName, QuestionName]
    method: 'cramer' | 'spearman'
    value: number
    threshold: number
    n: number
    // Spearman seulement
    lower: number | null
    adjustedP: number | null
    // V de Cramér seulement : conditions de Cochran remplies
    cochran: boolean | null
    // Réponse la plus liée : parmi les personnes qui donnent firstOption à la première question, count donnent secondOption
    strongest: { firstOption: string, secondOption: string, count: number, firstCount: number }
  }
  | {
    kind: 'indistinctByAnswers'
    level: 'review' | 'unsure'
    characters: [Named, Named]
    correlation: number
    lower: number
    adjustedP: number | null
    threshold: number
    n: number
  }
  | { kind: 'rarelyWanted', level: 'watch', character: Named, count: number, respondents: number }
  | { kind: 'overWanted', level: 'watch', character: Named, count: number, respondents: number }

/** Estimation générale (R13) ; la note est absente quand personne n'est compté. */
export type QuestionnaireEstimate = {
  level: QualityLevel
  note: { level: QualityLevel, value: number, lower: number, upper: number, counted: number, tooFewPeople: boolean } | null
  ties: { level: QualityLevel, count: number, total: number, share: number, lower: number }
  withoutRole: number
  withoutPoints: number
}

const LEVEL_ORDER: Record<QualityLevel, number> = { review: 0, unsure: 1, watch: 2, good: 3 }

/** Le plus grave des niveaux. */
export const worstLevel = (levels: QualityLevel[]) => levels.reduce((worst, level) => (LEVEL_ORDER[level] < LEVEL_ORDER[worst] ? level : worst), 'good')

// Du plus bloquant au moins bloquant pour le casting (R13) ; les repères absents de cette liste gardent leur ordre, après eux
const BLOCKING_ORDER: Array<QuestionnaireFinding['kind']> = ['characterWithoutLink', 'indistinctCharacters', 'indistinctByAnswers', 'dominantAnswer', 'scaleEnd', 'duplicateQuestions']
const blockingRank = ({ kind }: QuestionnaireFinding) => {
  const rank = BLOCKING_ORDER.indexOf(kind)
  return rank === -1 ? BLOCKING_ORDER.length : rank
}

// Du plus grave au moins grave puis, à gravité égale, du plus bloquant au moins bloquant
function sortFindings(findings: QuestionnaireFinding[]) {
  return [...findings].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || blockingRank(a) - blockingRank(b))
}

// Une réponse possible : une option d'une question à choix, ou une échelle (option vide) comptée à 5/5
type PossibleAnswer = { question: QualityQuestion, option: string, answer: string | string[] | number }

function possibleAnswers(questions: QualityQuestion[]): PossibleAnswer[] {
  return questions.flatMap((question): PossibleAnswer[] => {
    if (question.type === 'scale') return [{ question, option: '', answer: 5 }]
    if (!REGISTRATION_CHOICE_TYPES.includes(question.type)) return []
    return question.options.map((option) => ({ question, option, answer: question.type === 'multiple' ? [option] : option }))
  })
}

/** Profil de points d'un personnage (R6) : les points que lui donne chaque réponse possible, comme la note de l'assistant. */
export function pointProfile(character: QualityCharacter, questions: QualityQuestion[], links: CastingLink[]) {
  const linksOf = Map.groupBy(links, (link) => link.questionId)
  const casting = { ...character, relations: [] }
  return possibleAnswers(questions).map(({ question, answer }) => noteOf(casting, { [question.id]: answer }, [question], linksOf.get(question.id) ?? []))
}

/** La note de l'assistant de casting ; les relations n'y jouent pas. */
export function noteOf(character: CastingCharacter, answers: Record<string, unknown>, questions: QualityQuestion[], links: CastingLink[]) {
  return castingScore({ id: '', name: '', answers, refusedTypes: [], notWithIds: [] }, character, questions, links).score
}

/** Similarité cosinus de deux profils de points ; 0 si l'un est nul. */
export function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0
  let normA = 0
  let normB = 0
  a.forEach((value, index) => {
    const other = b[index] ?? 0
    dot += value * other
    normA += value * value
    normB += other * other
  })
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0
}

/** Repères sur les liens, avant les inscriptions (SPEC-015, R4 à R6), du plus grave au moins grave. */
export function linkFindings(questions: QualityQuestion[], links: CastingLink[], characters: QualityCharacter[]): QuestionnaireFinding[] {
  const findings: QuestionnaireFinding[] = []
  const answers = possibleAnswers(questions)
  const linkedQuestions = new Set(links.map((link) => link.questionId))
  const linkedOptions = new Set(links.map((link) => `${link.questionId}\u0000${link.option}`))

  // R5 : question à choix ou échelle sans lien ; option sans lien d'une question reliée par ailleurs
  for (const question of questions) {
    if (question.type !== 'scale' && !REGISTRATION_CHOICE_TYPES.includes(question.type)) continue
    const ref = { questionId: question.id, questionLabel: question.label }
    if (!linkedQuestions.has(question.id)) {
      findings.push({ kind: 'questionWithoutLink', level: 'watch', ...ref })
      continue
    }
    for (const option of question.type === 'scale' ? [] : question.options) {
      if (!linkedOptions.has(`${question.id}\u0000${option}`)) findings.push({ kind: 'optionWithoutLink', level: 'watch', option, ...ref })
    }
  }

  // R4 : personnage qu'aucune réponse ne rejoint ; R6 : paires de personnages reliés aux profils trop proches
  const profiles = characters.map((character) => ({ character, profile: pointProfile(character, questions, links) }))
  const reached = profiles.filter(({ character, profile }) => {
    if (profile.some((points) => points > 0)) return true
    findings.push({ kind: 'characterWithoutLink', level: 'review', character: { id: character.id, name: character.name } })
    return false
  })
  const threshold = QUESTIONNAIRE_THRESHOLDS.indistinctSimilarity
  reached.forEach((first, index) => {
    for (const second of reached.slice(index + 1)) {
      const similarity = cosineSimilarity(first.profile, second.profile)
      if (similarity < threshold) continue
      // Réponse dont l'écart de points entre les deux est le plus grand
      let widest = { index: -1, gap: 0 }
      for (const [index, points] of first.profile.entries()) {
        const gap = points - (second.profile[index] ?? 0)
        if (Math.abs(gap) > Math.abs(widest.gap)) widest = { index, gap }
      }
      const answer = answers[widest.index]
      const favors = widest.gap > 0 ? first.character : second.character
      const separating = answer ? { questionLabel: answer.question.label, option: answer.option, favors: { id: favors.id, name: favors.name } } : null
      findings.push({
        kind: 'indistinctCharacters',
        level: 'review',
        characters: [{ id: first.character.id, name: first.character.name }, { id: second.character.id, name: second.character.name }],
        similarity,
        threshold,
        separating
      })
    }
  })

  return sortFindings(findings)
}

type Answers = Record<string, unknown>

export const SCALE_OPTIONS = ['1', '2', '3', '4', '5']
export const optionsOf = (question: QualityQuestion) => (question.type === 'scale' ? SCALE_OPTIONS : question.options)

// Réponse d'une personne, en options actuelles : null si elle n'a pas répondu, vide si ses réponses n'existent plus (R7)
function givenOptions(question: QualityQuestion, answer: unknown): string[] | null {
  if (answer === null || answer === undefined || answer === '') return null
  const given = Array.isArray(answer) ? answer.map(String) : [String(answer)]
  if (!given.length) return null
  const options = optionsOf(question)
  return given.filter((option) => options.includes(option))
}

/** Réponses des personnes qui ont vraiment répondu (R7) : une seule ligne par personne dans le vivier (SPEC-018, R1). */
export function peopleWithAnswers(registrations: Array<{ questionAnswers: unknown }>) {
  return registrations
    .map(({ questionAnswers }) => questionAnswers)
    .filter((answers): answers is Answers => Boolean(answers) && typeof answers === 'object')
    .filter((answers) => Object.values(answers).some((answer) => answer !== null && answer !== '' && !(Array.isArray(answer) && !answer.length)))
}

// R8 et R9 : la réponse qui écrase les autres, et les extrémités d'une échelle
function distributionFindings(question: QualityQuestion, people: Answers[]): QuestionnaireFinding[] {
  const options = optionsOf(question)
  const counts = new Map(options.map((option) => [option, 0]))
  let total = 0
  let ignored = 0
  for (const answers of people) {
    const given = givenOptions(question, answers[question.id])
    if (!given) continue
    if (!given.length) {
      ignored++
      continue
    }
    total++
    for (const option of given) counts.set(option, counts.get(option)! + 1)
  }
  if (!total) return []

  const ref = { questionId: question.id, questionLabel: question.label }
  const countList = options.map((option) => counts.get(option)!)
  const shareOf = (option: string) => counts.get(option)! / total
  const measure = (option: string) => {
    const count = counts.get(option)!
    return { option, count, total, share: count / total, lower: wilsonInterval(count, total).lower, ignored }
  }
  const { dominantShare, scaleEndShare } = QUESTIONNAIRE_THRESHOLDS
  const multiple = question.type === 'multiple'
  const entropy = multiple ? null : normalizedEntropy(countList, options.length)
  const shares = multiple ? options.map((option) => ({ option, share: shareOf(option) })) : null
  const dominant = options.filter((option) => shareOf(option) >= dominantShare)
  const findings: QuestionnaireFinding[] = dominant.map((option) => {
    const measured = measure(option)
    return { kind: 'dominantAnswer', ...ref, ...measured, level: measured.lower >= dominantShare ? 'review' : 'unsure', questionType: question.type, threshold: dominantShare, entropy, shares }
  })
  if (question.type === 'scale') {
    const leik = leikDispersion(countList)
    for (const option of [options[0]!, options.at(-1)!]) {
      if (shareOf(option) <= scaleEndShare || dominant.includes(option)) continue
      const measured = measure(option)
      findings.push({ kind: 'scaleEnd', ...ref, ...measured, level: measured.lower > scaleEndShare ? 'review' : 'unsure', threshold: scaleEndShare, leik })
    }
  }
  return findings
}

// Ajoute à chaque paire testée sa valeur p corrigée par Holm, sur toute la famille des paires testées
function withAdjustedP<T extends { pValue: number | null }>(pairs: T[]) {
  const tested = pairs.filter((pair) => pair.pValue !== null)
  const adjusted = holmAdjust(tested.map((pair) => pair.pValue!))
  const adjustedOf = new Map(tested.map((pair, index) => [pair, adjusted[index]!]))
  return pairs.map((pair) => ({ ...pair, adjustedP: adjustedOf.get(pair) ?? null }))
}

const confirmedLevel = (adjustedP: number | null) => (adjustedP !== null && adjustedP < QUESTIONNAIRE_THRESHOLDS.alpha ? 'review' as const : 'unsure' as const)

// Une question, avec la réponse de chaque personne, dans le même ordre pour toutes les questions
type AnswerColumn = { question: QualityQuestion, given: Array<string | undefined> }

// R10 : une paire de questions, sur les personnes qui ont répondu aux deux ; null si l'une des deux n'a qu'une réponse,
// ou si deux échelles ont trop peu de réponses pour un intervalle (ADR-0063)
function comparePair(first: AnswerColumn, second: AnswerColumn) {
  const answered = first.given.flatMap((a, index) => {
    const b = second.given[index]
    return a !== undefined && b !== undefined ? [{ a, b }] : []
  })
  const seenFirst = new Set(answered.map(({ a }) => a))
  const seenSecond = new Set(answered.map(({ b }) => b))
  const rows = optionsOf(first.question).filter((option) => seenFirst.has(option))
  const columns = optionsOf(second.question).filter((option) => seenSecond.has(option))
  if (rows.length < 2 || columns.length < 2) return null
  const bothScales = first.question.type === 'scale' && second.question.type === 'scale'
  if (bothScales && answered.length < FISHER_MIN_N) return null

  const cellKey = (a: string, b: string) => `${a}\u0000${b}`
  const cells = new Map<string, number>()
  for (const { a, b } of answered) cells.set(cellKey(a, b), (cells.get(cellKey(a, b)) ?? 0) + 1)
  const table = rows.map((row) => columns.map((column) => cells.get(cellKey(row, column)) ?? 0))
  const { n, df, chiSquare, cramerV, cochran, expected } = contingency(table)
  // Réponse la plus liée : le plus grand résidu de Pearson
  let strongest = { firstOption: rows[0]!, secondOption: columns[0]!, count: 0, firstCount: 0 }
  let widest = -Infinity
  table.forEach((row, r) => row.forEach((count, c) => {
    const residual = (count - expected[r]![c]!) / Math.sqrt(expected[r]![c]!)
    if (residual > widest) {
      widest = residual
      strongest = { firstOption: rows[r]!, secondOption: columns[c]!, count, firstCount: row.reduce((sum, value) => sum + value, 0) }
    }
  }))
  const questions: [QuestionName, QuestionName] = [
    { id: first.question.id, label: first.question.label },
    { id: second.question.id, label: second.question.label }
  ]

  if (bothScales) {
    const value = Math.abs(spearman(answered.map(({ a }) => Number(a)), answered.map(({ b }) => Number(b))) ?? 0)
    const threshold = QUESTIONNAIRE_THRESHOLDS.duplicateScales
    // Erreur type de Bonett et Wright pour une corrélation de Spearman
    const { lower, pValue } = fisherTest(value, n, threshold, 1.06)
    return { over: value > threshold, pValue, finding: { questions, n, strongest, method: 'spearman' as const, value, threshold, lower, cochran: null } }
  }
  const threshold = QUESTIONNAIRE_THRESHOLDS.duplicateCramer / Math.sqrt(Math.min(rows.length, columns.length) - 1)
  // Le seuil de Cohen revient à w = 0,50 quel que soit le tableau : non-centralité 0,25 n (ADR-0063)
  const pValue = cochran ? noncentralChiSquareSurvival(chiSquare, df, QUESTIONNAIRE_THRESHOLDS.duplicateCramer ** 2 * n) : null
  return { over: cramerV >= threshold, pValue, finding: { questions, n, strongest, method: 'cramer' as const, value: cramerV, threshold, lower: null, cochran } }
}

function duplicateFindings(questions: QualityQuestion[], people: Answers[]): QuestionnaireFinding[] {
  const compared: AnswerColumn[] = questions
    .filter((question) => question.type === 'single' || question.type === 'scale')
    .map((question) => ({ question, given: people.map((answers) => givenOptions(question, answers[question.id])?.[0]) }))
  const pairs = compared.flatMap((first, index) => compared.slice(index + 1).flatMap((second) => comparePair(first, second) ?? []))
  return withAdjustedP(pairs).filter((pair) => pair.over).map(({ finding, adjustedP }) => ({
    kind: 'duplicateQuestions',
    level: confirmedLevel(adjustedP),
    adjustedP,
    ...finding
  }))
}

// R11 : personnages dont les notes varient ensemble chez les personnes qui ont répondu
function indistinctByAnswers(characters: QualityCharacter[], notes: number[][]): QuestionnaireFinding[] {
  const threshold = QUESTIONNAIRE_THRESHOLDS.indistinctNotes
  const n = notes.length
  // Trop peu de réponses pour un intervalle : une corrélation y vaut souvent 1 par hasard (ADR-0063)
  if (n < FISHER_MIN_N) return []
  const columns = characters.map((_, index) => notes.map((row) => row[index]!))
  const pairs = characters.flatMap((first, a) => characters.slice(a + 1).flatMap((second, offset) => {
    const correlation = pearson(columns[a]!, columns[a + offset + 1]!)
    return correlation === null ? [] : [{ first, second, correlation, ...fisherTest(correlation, n, threshold) }]
  }))
  return withAdjustedP(pairs).filter((pair) => pair.correlation >= threshold).map(({ first, second, correlation, lower, adjustedP }) => ({
    kind: 'indistinctByAnswers',
    level: confirmedLevel(adjustedP),
    characters: [{ id: first.id, name: first.name }, { id: second.id, name: second.name }],
    correlation,
    lower,
    adjustedP,
    threshold,
    n
  }))
}

/** R12 : pour chaque personnage, présences parmi les 3 meilleurs de chaque personne et premières places, ex æquo compris, note non nulle. */
export function demandCounts(notes: number[][], characterCount: number) {
  const { topCharacters } = QUESTIONNAIRE_THRESHOLDS
  const inTop = new Array<number>(characterCount).fill(0)
  const best = new Array<number>(characterCount).fill(0)
  for (const row of notes) {
    const positive = row.filter((note) => note > 0).sort((a, b) => b - a)
    if (!positive.length) continue
    const cutoff = positive[Math.min(topCharacters, positive.length) - 1]!
    row.forEach((note, index) => {
      if (note >= cutoff) inTop[index]!++
      if (note === positive[0]) best[index]!++
    })
  }
  return { inTop, best }
}

function demandFindings(characters: QualityCharacter[], notes: number[][], withoutLink: Set<string>): QuestionnaireFinding[] {
  const { rarelyWanted, overWanted } = QUESTIONNAIRE_THRESHOLDS
  const { inTop, best } = demandCounts(notes, characters.length)
  const respondents = notes.length
  const showRare = respondents >= characters.length / 2
  return characters.flatMap((character, index): QuestionnaireFinding[] => {
    // Un personnage sans lien a déjà son repère « à revoir » (R4)
    if (withoutLink.has(character.id)) return []
    const named = { id: character.id, name: character.name }
    return [
      ...(showRare && inTop[index]! < rarelyWanted ? [{ kind: 'rarelyWanted' as const, level: 'watch' as const, character: named, count: inTop[index]!, respondents }] : []),
      ...(best[index]! > overWanted ? [{ kind: 'overWanted' as const, level: 'watch' as const, character: named, count: best[index]!, respondents }] : [])
    ]
  })
}

/** R13 : ce que l'affectation optimale de l'assistant donne à chaque personne placée, rapporté à sa meilleure note. */
export function assignmentRatios(notes: number[][], characterCount: number) {
  // Une personne sans aucun point n'entre pas dans l'affectation : elle prendrait un rôle au hasard à une personne comptée
  const scored = notes.flatMap((row) => {
    const best = Math.max(...row)
    return best > 0 ? [{ row, best }] : []
  })
  const ratios = optimalAssignment(scored.length, characterCount, (row, column) => scored[row]!.row[column]!)
    .flatMap((column, row) => (column === -1 ? [] : [scored[row]!.row[column]! / scored[row]!.best]))
  return { ratios, scoredCount: scored.length }
}

/** R13 : personnes dont la meilleure note est atteinte par plusieurs personnages ; une personne sans aucun point les a tous à égalité. */
export function tiedCount(notes: number[][]) {
  return notes.filter((row) => {
    const best = Math.max(...row)
    return row.filter((value) => value === best).length > 1
  }).length
}

function questionnaireEstimate(notes: number[][], characterCount: number): QuestionnaireEstimate | null {
  if (!notes.length || !characterCount) return null
  const { estimateGood, estimateReview, tiedShare } = QUESTIONNAIRE_THRESHOLDS
  const { ratios, scoredCount } = assignmentRatios(notes, characterCount)

  let note: QuestionnaireEstimate['note'] = null
  if (ratios.length) {
    const sum = ratios.reduce((total, ratio) => total + ratio, 0)
    const value = sum / ratios.length
    // La variance d'une moyenne entre 0 et 1 ne dépasse pas celle d'une proportion : Wilson s'y applique (ADR-0064)
    const { lower, upper } = wilsonInterval(sum, ratios.length)
    const noteLevel = (): QualityLevel => {
      if (scoredCount < characterCount) return 'unsure'
      if (value >= estimateGood) return 'good'
      if (value >= estimateReview) return 'watch'
      return upper < estimateReview ? 'review' : 'unsure'
    }
    note = { level: noteLevel(), value, lower, upper, counted: ratios.length, tooFewPeople: scoredCount < characterCount }
  }

  const count = tiedCount(notes)
  const total = notes.length
  const share = count / total
  const { lower } = wilsonInterval(count, total)
  const tiesLevel = (): QualityLevel => {
    if (share <= tiedShare) return 'good'
    return lower > tiedShare ? 'review' : 'unsure'
  }
  const ties = { level: tiesLevel(), count, total, share, lower }

  return {
    level: worstLevel(note ? [note.level, ties.level] : [ties.level]),
    note,
    ties,
    withoutRole: scoredCount - ratios.length,
    withoutPoints: total - scoredCount
  }
}

/** Les questions à choix ou échelles reliées à un rôle. */
export function linkedQuestions(questions: QualityQuestion[], links: CastingLink[]) {
  const linkedIds = new Set(links.map((link) => link.questionId))
  return questions.filter((question) => linkedIds.has(question.id) && (question.type === 'scale' || REGISTRATION_CHOICE_TYPES.includes(question.type)))
}

/** Tous les repères du questionnaire (SPEC-015, R4 à R12), du plus grave au moins grave, et son estimation générale (R13). */
export function questionnaireFindings(questions: QualityQuestion[], links: CastingLink[], characters: QualityCharacter[], people: Answers[]) {
  const fromLinks = linkFindings(questions, links, characters)
  const withoutLink = new Set(fromLinks.flatMap((finding) => (finding.kind === 'characterWithoutLink' ? [finding.character.id] : [])))
  const linked = linkedQuestions(questions, links)
  // Personnes qui ont répondu à une question reliée, avec une option qui existe encore
  const respondents = people.filter((answers) => linked.some((question) => givenOptions(question, answers[question.id])?.length))
  const castings = characters.map((character) => ({ ...character, relations: [] }))
  const notes = respondents.map((answers) => castings.map((character) => noteOf(character, answers, linked, links)))
  return {
    respondentCount: respondents.length,
    estimate: questionnaireEstimate(notes, characters.length),
    findings: sortFindings([
      ...fromLinks,
      ...linked.flatMap((question) => distributionFindings(question, people)),
      ...duplicateFindings(linked, respondents),
      ...indistinctByAnswers(characters, notes),
      ...demandFindings(characters, notes, withoutLink)
    ])
  }
}
