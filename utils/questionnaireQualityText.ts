// Phrases des repères sur le questionnaire de casting (SPEC-015, R2) : phrase, ce qu'il faut faire, détail replié
import { QUESTIONNAIRE_THRESHOLDS as THRESHOLDS, type QualityLevel, type QuestionnaireEstimate, type QuestionnaireFinding } from './questionnaireQuality'

export const QUALITY_LEVELS: Record<QualityLevel, { label: string, color: 'success' | 'warning' | 'error' | 'neutral' }> = {
  good: { label: 'Bon', color: 'success' },
  watch: { label: 'À surveiller', color: 'warning' },
  review: { label: 'À revoir', color: 'error' },
  unsure: { label: 'À confirmer', color: 'neutral' }
}

const decimal = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
// Une borne basse s'arrondit vers le bas : jamais affichée au seuil sans l'avoir atteint
const lowerBound = (value: number) => decimal(Math.floor(value * 1000) / 1000)
// Une borne haute s'arrondit vers le haut, pour la même raison
const upperBound = (value: number) => decimal(Math.ceil(value * 1000) / 1000)
const adjustedP = (value: number | null) => {
  if (value === null) return 'non calculable'
  return value < 0.001 ? 'moins de 0,001' : decimal(value)
}
const peopleCount = (count: number) => `${count} personne${count > 1 ? 's' : ''}`
// « 8 personnes sur 10 ont », « 1 personne sur 10 a »
const peopleOutOf = (count: number, total: number) => `${peopleCount(count)} sur ${total} ${count > 1 ? 'ont' : 'a'}`
const ignoredDetail = (ignored: number) => (ignored ? ` ${ignored} réponse${ignored > 1 ? 's' : ''} à une option qui n’existe plus, laissée${ignored > 1 ? 's' : ''} de côté.` : '')
// Ce qu'il faut faire, précédé de l'attente quand les réponses ne suffisent pas encore à conclure (R7)
const todoFor = (level: QualityLevel, received: number, action: string) => (level === 'unsure'
  ? `Pas encore certain, avec ${peopleCount(received)} : attendez d’autres réponses. Si cela se confirme : ${action.charAt(0).toLowerCase()}${action.slice(1)}`
  : action)

/** Ce sur quoi portent les repères affichés. */
export function qualityScope(respondentCount: number) {
  return `Ces repères portent sur le formulaire et les liens enregistrés${respondentCount ? `, et sur les réponses de ${peopleCount(respondentCount)}` : ''}.`
}

/** Phrases de l'estimation générale (R13), et renvoi aux repères à revoir, en tête de la liste. */
export function describeEstimate(estimate: QuestionnaireEstimate, reviewCount: number) {
  const { note, ties, withoutRole, withoutPoints } = estimate
  const { estimateGood, estimateReview, tiedShare } = THRESHOLDS
  const noteTodo = (level: QualityLevel, counted: number) => {
    if (level === 'good') return ''
    return todoFor(level, counted, 'Reliez davantage de réponses à des personnages précis, et diversifiez les questions où presque tout le monde répond pareil.')
  }
  const left = `${withoutRole} sans rôle, ${withoutPoints} sans aucun point.`
  return {
    level: estimate.level,
    summary: reviewCount ? `${reviewCount} repère${reviewCount > 1 ? 's' : ''} à revoir, en tête de la liste, du plus bloquant au moins bloquant pour le casting.` : '',
    note: note && {
      level: note.level,
      sentence: `Une fois les rôles répartis au mieux, chaque personne obtient en moyenne ${Math.round(note.value * 100)} % de sa meilleure note possible.`,
      todo: note.tooFewPeople
        ? 'Moins de personnes que de rôles pour l’instant : chacune obtient presque toujours son meilleur personnage. Attendez d’autres réponses.'
        : noteTodo(note.level, note.counted),
      detail: `Note moyenne : ${decimal(note.value)} ; intervalle de Wilson à 95 % : ${lowerBound(note.lower)} à ${upperBound(note.upper)} ; seuils : bon ${decimal(estimateGood)}, à revoir ${decimal(estimateReview)}, choix de l’utilisatrice. ${peopleCount(note.counted)} dans la note. ${left} SPEC-015, R13 ; ADR-0064.`
    },
    ties: {
      level: ties.level,
      sentence: `${peopleOutOf(ties.count, ties.total)} plusieurs personnages à égalité en tête.`,
      todo: ties.level === 'good' ? '' : todoFor(ties.level, ties.total, 'Reliez des réponses à des personnages précis plutôt qu’à leur seule faction ou intrigue, pour les départager.'),
      detail: `Part : ${decimal(ties.share)} ; borne basse de Wilson à 95 % : ${lowerBound(ties.lower)} ; seuil : ${decimal(tiedShare)}, choix de l’utilisatrice. ${left} SPEC-015, R13 ; ADR-0064.`
    }
  }
}

/** Phrase, ce qu'il faut faire, et détail replié (valeur, seuil, référence) d'un repère. */
export function describeFinding(finding: QuestionnaireFinding) {
  switch (finding.kind) {
    case 'characterWithoutLink':
      return {
        sentence: `${finding.character.name} n’est relié à aucune réponse : l’assistant ne pourra lui proposer personne.`,
        todo: 'Reliez une option à ce personnage, à sa faction ou à son intrigue.',
        detail: 'Note maximale possible : 0 point. SPEC-015, R4.'
      }
    case 'questionWithoutLink':
      return {
        sentence: `« ${finding.questionLabel} » n’est reliée à aucun rôle : ses réponses ne comptent pas dans le casting.`,
        todo: 'Reliez ses réponses à des personnages, des factions ou des intrigues, ou laissez-la ainsi si elle ne sert pas au casting.',
        detail: 'Aucun lien sur la question. SPEC-015, R5.'
      }
    case 'optionWithoutLink':
      return {
        sentence: `L’option « ${finding.option} » de « ${finding.questionLabel} » n’est reliée à aucun rôle.`,
        todo: 'Reliez-la à un rôle, ou laissez-la ainsi si elle ne doit rapprocher de personne.',
        detail: 'Aucun lien sur l’option, alors que la question en a. SPEC-015, R5.'
      }
    case 'indistinctCharacters': {
      const [first, second] = finding.characters
      const { separating } = finding
      return {
        sentence: `${first.name} et ${second.name} rapportent presque les mêmes points pour chaque réponse : le questionnaire aura du mal à les départager.`,
        todo: separating
          ? `La réponse qui les sépare le plus est « ${separating.option || 'note haute'} » à « ${separating.questionLabel} », en faveur de ${separating.favors.name} : reliez d’autres réponses à l’un sans l’autre.`
          : `Aucune réponse ne les sépare : reliez une réponse à ${first.name} sans ${second.name}, ou l’inverse.`,
        detail: `Similarité cosinus des profils de points : ${decimal(finding.similarity)}. Seuil : ${decimal(finding.threshold)}, choix de l’utilisatrice (« 8 points sur 10 en commun »). SPEC-015, R6 ; ADR-0061.`
      }
    }
    case 'dominantAnswer': {
      const measured = finding.shares
        ? `Part de chaque option : ${finding.shares.map(({ option, share }) => `${option} ${decimal(share)}`).join(', ')}.`
        : `Entropie normalisée : ${decimal(finding.entropy ?? 0)}.`
      return {
        sentence: finding.questionType === 'multiple'
          ? `${peopleOutOf(finding.count, finding.total)} coché « ${finding.option} » à « ${finding.questionLabel} » : cette option ne départage presque personne.`
          : `${peopleOutOf(finding.count, finding.total)} répondu « ${finding.option} » à « ${finding.questionLabel} » : cette question ne départage presque personne.`,
        todo: todoFor(finding.level, finding.total, 'Reformulez la question ou ses options pour que les réponses se répartissent mieux.'),
        detail: `Part : ${decimal(finding.share)} ; borne basse de Wilson à 95 % : ${lowerBound(finding.lower)} ; seuil : ${decimal(finding.threshold)}, choix de l’utilisatrice. ${measured}${ignoredDetail(finding.ignored)} SPEC-015, R8 ; Wilson (1927), Dahl et Østerås (2010).`
      }
    }
    case 'scaleEnd':
      return {
        sentence: `${peopleOutOf(finding.count, finding.total)} donné la note ${finding.option} à « ${finding.questionLabel} » : l’échelle est tassée à cette extrémité.`,
        todo: todoFor(finding.level, finding.total, 'Reformulez la question, pour que les notes intermédiaires aient un sens plus clair.'),
        detail: `Part : ${decimal(finding.share)} ; borne basse de Wilson à 95 % : ${lowerBound(finding.lower)} ; seuil : ${decimal(finding.threshold)}, la part de cette note dans une répartition égale. Dispersion de Leik : ${decimal(finding.leik)}.${ignoredDetail(finding.ignored)} SPEC-015, R9 ; ADR-0063 ; Leik (1966).`
      }
    case 'duplicateQuestions': {
      const [first, second] = finding.questions
      const { strongest } = finding
      const indicator = finding.method === 'spearman'
        ? `Corrélation de Spearman, en valeur absolue : ${decimal(finding.value)} ; borne basse à 95 % : ${lowerBound(finding.lower ?? 0)} ; seuil : ${decimal(finding.threshold)}. Clark et Watson (1995), Bonett et Wright (2000).`
        : `V de Cramér corrigé : ${decimal(finding.value)} ; seuil « fort » de Cohen pour ce tableau : ${decimal(finding.threshold)} ; conditions de Cochran ${finding.cochran ? 'remplies' : 'non remplies'}. Bergsma (2013), Cohen (1988).`
      return {
        sentence: `« ${first.label} » et « ${second.label} » font doublon : sur ${peopleCount(strongest.firstCount)} qui répond${strongest.firstCount > 1 ? 'ent' : ''} « ${strongest.firstOption} » à la première, ${strongest.count} répond${strongest.count > 1 ? 'ent' : ''} « ${strongest.secondOption} » à la seconde.`,
        todo: todoFor(finding.level, finding.n, 'Retirez l’une des deux questions, ou changez-la pour qu’elle apporte autre chose.'),
        detail: `${indicator} Valeur p corrigée par Holm : ${adjustedP(finding.adjustedP)}. Réponses aux deux questions : ${finding.n}. SPEC-015, R10 ; ADR-0063.`
      }
    }
    case 'indistinctByAnswers': {
      const [first, second] = finding.characters
      return {
        sentence: `${first.name} et ${second.name} reçoivent presque les mêmes notes chez les ${finding.n} personnes qui ont répondu : le casting aura du mal à les départager.`,
        todo: todoFor(finding.level, finding.n, `Reliez d’autres réponses à ${first.name} sans ${second.name}, ou l’inverse.`),
        detail: `Corrélation de Pearson des notes : ${decimal(finding.correlation)} ; borne basse à 95 % : ${lowerBound(finding.lower)} ; seuil : ${decimal(finding.threshold)} ; valeur p corrigée par Holm : ${adjustedP(finding.adjustedP)}. SPEC-015, R11 ; ADR-0063 ; Henseler, Ringle et Sarstedt (2015).`
      }
    }
    case 'rarelyWanted': {
      const top = `${THRESHOLDS.topCharacters} personnages les mieux notés`
      const none = finding.respondents > 1 ? `d’aucune des ${finding.respondents} personnes qui ont répondu` : 'de la seule personne qui a répondu'
      return {
        sentence: finding.count
          ? `${finding.character.name} ne figure parmi les ${top} que pour ${peopleCount(finding.count)} sur ${finding.respondents} : peu de monde correspond à ce personnage.`
          : `${finding.character.name} ne figure parmi les ${top} ${none} : personne ne correspond à ce personnage pour l’instant.`,
        todo: 'Reliez ce personnage à des réponses plus souvent choisies, ou vérifiez que c’est voulu.',
        detail: `Présence parmi les ${THRESHOLDS.topCharacters} meilleurs : ${finding.count}. Seuil : moins de ${THRESHOLDS.rarelyWanted}, choix de l’utilisatrice. SPEC-015, R12 ; ADR-0061.`
      }
    }
    case 'overWanted':
      return {
        sentence: `${finding.character.name} arrive en tête pour ${finding.count} personnes sur ${finding.respondents} : ce personnage sera disputé.`,
        todo: 'Prévoyez des personnages proches pour les personnes qui ne l’auront pas, ou revoyez ses liens s’il attire trop largement.',
        detail: `Meilleur personnage de ${finding.count} personnes, ex æquo compris. Seuil : plus de ${THRESHOLDS.overWanted}, choix de l’utilisatrice. SPEC-015, R12 ; ADR-0061.`
      }
  }
}
