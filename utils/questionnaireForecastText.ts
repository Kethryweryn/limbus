// Phrases de la prévision du questionnaire (SPEC-016, R4 à R9) : comme les repères, phrase, ce qu'il faut faire, détail replié
import { FORECAST_RUNS, type QuestionnaireForecast } from './questionnaireForecast'
import { QUESTIONNAIRE_THRESHOLDS as THRESHOLDS } from './questionnaireQuality'
import { decimal, lowerBound, NOTE_ACTION, TIES_ACTION, upperBound } from './questionnaireQualityText'

const percentDown = (value: number) => Math.floor(value * 100 + 1e-9)
const percentUp = (value: number) => Math.ceil(value * 100 - 1e-9)
const bits = (value: number) => `${decimal(value)} bit${value > 1 ? 's' : ''}`
const characterCount = (count: number) => `${count} personnage${count > 1 ? 's' : ''}`
// Au-delà du milliard, le nombre n'apporte plus rien à la lecture
const profileCount = (profiles: number) => (profiles > 1e9
  ? 'plus d’un milliard de profils'
  : `au plus ${profiles.toLocaleString('fr-FR')} profil${profiles > 1 ? 's' : ''}`)
// Une part de simulations, en dixièmes : « 10 sur 10 » n'est dit que si c'est le cas de toutes
const outOfTen = (share: number) => {
  const tenths = share < 1 ? Math.min(Math.round(share * 10), 9) : 10
  return `${tenths} simulation${tenths > 1 ? 's' : ''} sur 10`
}

function describeInformation({ level, profiles, bits: total, requiredBits, characterCount: count, questions }: QuestionnaireForecast['information']) {
  const perQuestion = questions.map(({ label, bits: value, expected }) => `« ${label} » : ${bits(value)}${expected === null ? '' : `, ${bits(expected)} attendu${expected > 1 ? 's' : ''} avec vos proportions`}`).join(' ; ')
  return {
    level,
    sentence: `Vos questions distinguent ${profileCount(profiles)} de réponses, pour ${characterCount(count)}${level === 'good' && count > 1 ? ' : c’est assez pour les départager' : ''}.`,
    todo: level === 'good' ? '' : 'Ajoutez des questions reliées, ou reliez à des rôles différents les options qui donnent aujourd’hui les mêmes points.',
    detail: `Information maximale : ${bits(total)} ; il en faut au moins ${bits(requiredBits)}. ${perQuestion}. Condition nécessaire, pas suffisante : la simulation juge le reste. SPEC-016, R5 ; ADR-0062 ; Shannon (1948).`
  }
}

/** Ce sur quoi porte la prévision, et ce qu'elle suppose (ADR-0062). */
export function forecastScope({ simulation, linkedCount, withShares }: QuestionnaireForecast) {
  const base = `Prévision sur le formulaire, les liens et les proportions enregistrés : ${simulation.people} personne${simulation.people > 1 ? 's' : ''} fictive${simulation.people > 1 ? 's' : ''}, autant que de personnages, ${FORECAST_RUNS.toLocaleString('fr-FR')} fois de suite.`
  if (!withShares) return `${base} Chaque réponse a la même chance : de vraies réponses ne se répartissent jamais également, cette prévision est donc optimiste. Indiquez les proportions attendues sous chaque question pour l’affiner.`
  if (withShares < linkedCount) return `${base} ${withShares} question${withShares > 1 ? 's' : ''} reliée${withShares > 1 ? 's' : ''} sur ${linkedCount} ${withShares > 1 ? 'suivent' : 'suit'} vos proportions ; pour les autres, chaque réponse a la même chance, ce qui rend la prévision optimiste.`
  return `${base} Les réponses suivent vos proportions.`
}

/** Toutes les lignes de la prévision, de l'information aux personnages à surveiller. */
export function describeForecast(forecast: QuestionnaireForecast) {
  const { information, simulation: { note, ties, demand } } = forecast
  const { estimateGood, estimateReview, tiedShare, topCharacters, rarelyWanted, overWanted } = THRESHOLDS
  const items = [describeInformation(information)]
  if (note) {
    items.push({
      level: note.level,
      // Arrondi vers le bas : jamais affichée au seuil sans l'avoir atteint
      sentence: `Pour une inscription typique, chaque personne qui reçoit un rôle obtiendrait en moyenne ${percentDown(note.median)} % de sa meilleure note possible (de ${percentDown(note.lower)} à ${percentUp(note.upper)} % selon les simulations).`,
      todo: note.level === 'good' ? '' : NOTE_ACTION,
      detail: `Médiane de la note moyenne : ${lowerBound(note.median)} ; 95 % des simulations entre ${lowerBound(note.lower)} et ${upperBound(note.upper)} ; seuils : bon ${decimal(estimateGood)}, à revoir ${decimal(estimateReview)}, choix de l’utilisatrice. SPEC-016, R9 ; ADR-0064.`
    })
  }
  items.push({
    level: ties.level,
    // Arrondi vers le haut : jamais affichée au seuil en l'ayant dépassé
    sentence: `Pour une inscription typique, ${percentUp(ties.median)} % des personnes auraient plusieurs personnages à égalité en tête (de ${percentDown(ties.lower)} à ${percentUp(ties.upper)} % selon les simulations).`,
    todo: ties.level === 'good' ? '' : TIES_ACTION,
    detail: `Médiane de la part : ${upperBound(ties.median)} ; 95 % des simulations entre ${lowerBound(ties.lower)} et ${upperBound(ties.upper)} ; seuil : ${decimal(tiedShare)}, choix de l’utilisatrice. SPEC-016, R9 ; ADR-0064.`
  })
  for (const entry of demand) {
    items.push(entry.kind === 'rarelyWanted'
      ? {
          level: 'watch',
          sentence: `${entry.character.name} serait peu demandé dans ${outOfTen(entry.share)}.`,
          todo: 'Reliez ce personnage à des réponses plus souvent choisies, ou vérifiez que c’est voulu.',
          detail: `Médiane de sa présence parmi les ${topCharacters} meilleurs : ${decimal(entry.median)}. Seuil : moins de ${rarelyWanted}, choix de l’utilisatrice. SPEC-016, R8 ; ADR-0061.`
        }
      : {
          level: 'watch',
          sentence: `${entry.character.name} serait disputé dans ${outOfTen(entry.share)}.`,
          todo: 'Prévoyez des personnages proches pour les personnes qui ne l’auront pas, ou revoyez ses liens s’il attire trop largement.',
          detail: `Médiane de ses premières places, ex æquo compris : ${decimal(entry.median)}. Seuil : plus de ${overWanted}, choix de l’utilisatrice. SPEC-016, R8 ; ADR-0061.`
        })
  }
  return items
}
