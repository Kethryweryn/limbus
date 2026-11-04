<template>
  <section class="space-y-2">
    <h3 class="font-semibold">Qualité du questionnaire</h3>
    <p v-if="errorMessage" class="text-sm text-error-600">{{ errorMessage }}</p>
    <template v-else-if="quality">
      <p v-if="!quality.characterCount" class="text-sm text-gray-500">Le jeu n’a pas encore de personnage PJ : les repères sur les personnages viendront avec eux.</p>
      <p v-if="!quality.questionCount" class="text-sm text-gray-500">
        Aucune question à choix ni échelle : le questionnaire ne sert pas encore au casting.
      </p>
      <p v-if="quality.characterCount && quality.questionCount && !quality.findings.length" class="text-sm text-success-700">
        Bon : chaque personnage PJ est relié à une réponse, et les liens permettent de choisir entre eux.{{ quality.respondentCount ? ' Les réponses reçues ne signalent rien non plus.' : '' }}
      </p>
      <ul v-if="items.length" class="space-y-2">
        <li v-for="(item, index) in items" :key="index" class="rounded border border-gray-200 px-3 py-2 text-sm">
          <div class="flex flex-wrap items-start gap-2">
            <UBadge :color="LEVELS[item.level].color" variant="subtle" size="sm">{{ LEVELS[item.level].label }}</UBadge>
            <span class="min-w-0 flex-1 text-gray-800">{{ item.sentence }}</span>
          </div>
          <p class="mt-1 text-gray-600">{{ item.todo }}</p>
          <details class="mt-1 text-xs text-gray-500">
            <summary class="cursor-pointer">Détail</summary>
            <p class="mt-1">{{ item.detail }}</p>
          </details>
        </li>
      </ul>
      <p class="text-xs text-gray-500">{{ scope }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { QualityLevel, QuestionnaireFinding } from '~/utils/questionnaireQuality'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

// Encadré « Qualité du questionnaire » de l'éditeur du formulaire (US-133, US-134, US-136 à US-139, SPEC-015) : relu à chaque
// enregistrement (refreshKey)
const props = defineProps<{
  gameId: string
  refreshKey: number
}>()

const LEVELS: Record<QualityLevel, { label: string, color: 'success' | 'warning' | 'error' | 'neutral' }> = {
  good: { label: 'Bon', color: 'success' },
  watch: { label: 'À surveiller', color: 'warning' },
  review: { label: 'À revoir', color: 'error' },
  unsure: { label: 'À confirmer', color: 'neutral' }
}

const quality = ref<ApiResponse<'/api/games/:id/registration-form-quality'> | null>(null)
const errorMessage = ref('')
// Seule la dernière lecture compte : une réponse plus lente d'une lecture précédente est ignorée
let lastRequest = 0

watch(() => [props.gameId, props.refreshKey], async () => {
  const request = ++lastRequest
  try {
    const result = await useApiFetch(`/api/games/${props.gameId}/registration-form-quality`, { offlineCache: true })
    if (request !== lastRequest) return
    quality.value = result
    errorMessage.value = ''
  } catch (err) {
    if (request === lastRequest) errorMessage.value = apiErrorMessage(err, 'Impossible de calculer la qualité du questionnaire')
  }
}, { immediate: true })

const items = computed(() => (quality.value?.findings ?? []).map((finding) => ({ level: finding.level, ...describe(finding) })))

const decimal = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
const optional = (value: number | null) => (value === null ? 'non calculable' : decimal(value))
const peopleCount = (count: number) => `${count} personne${count > 1 ? 's' : ''}`
// « 8 personnes sur 10 ont », « 1 personne sur 10 a »
const peopleOutOf = (count: number, total: number) => `${peopleCount(count)} sur ${total} ${count > 1 ? 'ont' : 'a'}`
const ignoredDetail = (ignored: number) => (ignored ? ` ${ignored} réponse${ignored > 1 ? 's' : ''} à une option qui n’existe plus, laissée${ignored > 1 ? 's' : ''} de côté.` : '')
// Ce qu'il faut faire, précédé de l'attente quand les réponses ne suffisent pas encore à conclure (R7)
const todoFor = (level: QualityLevel, received: number, action: string) => (level === 'unsure'
  ? `Pas encore certain, avec ${peopleCount(received)} : attendez d’autres réponses. Si cela se confirme : ${action.charAt(0).toLowerCase()}${action.slice(1)}`
  : action)

const scope = computed(() => {
  const count = quality.value?.respondentCount ?? 0
  return `Ces repères portent sur le formulaire et les liens enregistrés${count ? `, et sur les réponses de ${peopleCount(count)}` : ''}.`
})

// Phrase, ce qu'il faut faire, et détail replié (valeur, seuil, référence) de chaque repère (SPEC-015, R2)
function describe(finding: QuestionnaireFinding) {
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
        detail: `Part : ${decimal(finding.share)} ; borne basse de Wilson à 95 % : ${decimal(finding.lower)} ; seuil : ${decimal(finding.threshold)}, choix de l’utilisatrice. ${measured}${ignoredDetail(finding.ignored)} SPEC-015, R8 ; Wilson (1927), Dahl et Østerås (2010).`
      }
    }
    case 'scaleEnd':
      return {
        sentence: `${peopleOutOf(finding.count, finding.total)} donné la note ${finding.option} à « ${finding.questionLabel} » : l’échelle est tassée à cette extrémité.`,
        todo: todoFor(finding.level, finding.total, 'Reformulez la question, pour que les notes intermédiaires aient un sens plus clair.'),
        detail: `Part : ${decimal(finding.share)} ; borne basse de Wilson à 95 % : ${decimal(finding.lower)} ; seuil : ${decimal(finding.threshold)}, la part de cette note dans une répartition égale. Dispersion de Leik : ${decimal(finding.leik)}.${ignoredDetail(finding.ignored)} SPEC-015, R9 ; ADR-0063 ; Leik (1966).`
      }
    case 'duplicateQuestions': {
      const [first, second] = finding.questions
      const { strongest } = finding
      const indicator = finding.method === 'spearman'
        ? `Corrélation de Spearman, en valeur absolue : ${decimal(finding.value)} ; borne basse à 95 % : ${optional(finding.lower)} ; seuil : ${decimal(finding.threshold)}. Clark et Watson (1995), Bonett et Wright (2000).`
        : `V de Cramér corrigé : ${decimal(finding.value)} ; seuil « fort » de Cohen pour ce tableau : ${decimal(finding.threshold)} ; conditions de Cochran ${finding.cochran ? 'remplies' : 'non remplies'}. Bergsma (2013), Cohen (1988).`
      return {
        sentence: `« ${first.label} » et « ${second.label} » font doublon : sur ${peopleCount(strongest.firstCount)} qui répondent « ${strongest.firstOption} » à la première, ${strongest.count} répondent « ${strongest.secondOption} » à la seconde.`,
        todo: todoFor(finding.level, finding.n, 'Retirez l’une des deux questions, ou changez-la pour qu’elle apporte autre chose.'),
        detail: `${indicator} Valeur p corrigée par Holm : ${optional(finding.adjustedP)}. Réponses aux deux questions : ${finding.n}. SPEC-015, R10 ; ADR-0063.`
      }
    }
    case 'indistinctByAnswers': {
      const [first, second] = finding.characters
      return {
        sentence: `${first.name} et ${second.name} reçoivent presque les mêmes notes chez les ${peopleCount(finding.n)} qui ont répondu : le casting aura du mal à les départager.`,
        todo: todoFor(finding.level, finding.n, `Reliez d’autres réponses à ${first.name} sans ${second.name}, ou l’inverse.`),
        detail: `Corrélation de Pearson des notes : ${decimal(finding.correlation)} ; borne basse à 95 % : ${optional(finding.lower)} ; seuil : ${decimal(finding.threshold)} ; valeur p corrigée par Holm : ${optional(finding.adjustedP)}. SPEC-015, R11 ; ADR-0063 ; Henseler, Ringle et Sarstedt (2015).`
      }
    }
    case 'rarelyWanted':
      return {
        sentence: finding.count
          ? `${finding.character.name} ne figure parmi les 3 personnages les mieux notés que pour ${finding.count} personne sur ${finding.respondents} : peu de monde correspond à ce personnage.`
          : `${finding.character.name} ne figure parmi les 3 personnages les mieux notés d’aucune des ${peopleCount(finding.respondents)} : personne ne correspond à ce personnage pour l’instant.`,
        todo: 'Reliez ce personnage à des réponses plus souvent choisies, ou vérifiez que c’est voulu.',
        detail: `Présence parmi les 3 meilleurs : ${finding.count}. Seuil : moins de 2, choix de l’utilisatrice. SPEC-015, R12 ; ADR-0061.`
      }
    case 'overWanted':
      return {
        sentence: `${finding.character.name} arrive en tête pour ${finding.count} personnes sur ${finding.respondents} : ce personnage sera disputé.`,
        todo: 'Prévoyez des personnages proches pour les personnes qui ne l’auront pas, ou revoyez ses liens s’il attire trop largement.',
        detail: `Meilleur personnage de ${finding.count} personnes, ex æquo compris. Seuil : plus de 3, choix de l’utilisatrice. SPEC-015, R12 ; ADR-0061.`
      }
  }
}
</script>
