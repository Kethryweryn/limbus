<template>
  <UModal v-model:open="open" :title="registration ? registration.participant.name : 'Inscription'">
    <template #body>
      <UAlert v-if="errorMessage" color="error" variant="soft" :description="errorMessage" />
      <p v-else-if="!registration" class="text-sm text-gray-500">Chargement…</p>
      <div v-else class="space-y-4 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="statusMeta.color" variant="subtle">{{ statusMeta.label }}</UBadge>
        </div>
        <UAlert
          v-if="registration.sessionLines.some((line) => line.missingFromSession)"
          color="warning"
          variant="soft"
          description="Cette personne a confirmé, mais n’est plus participante d’une session : elle en a été retirée depuis l’écran de session."
        />

        <section v-if="registration.respondedAt" class="space-y-1">
          <h3 class="font-semibold text-gray-700">Contact</h3>
          <p>{{ [registration.firstName, registration.lastName].filter(Boolean).join(' ') || '—' }}</p>
          <p>{{ registration.email }}</p>
          <p v-if="registration.phone">{{ registration.phone }}</p>
          <p v-if="registration.facebookName" class="text-gray-600">Facebook : {{ registration.facebookName }}</p>
        </section>

        <section v-if="registration.respondedAt" class="space-y-1">
          <h3 class="font-semibold text-gray-700">Contact d’urgence</h3>
          <p>{{ [registration.emergencyContactName, registration.emergencyContactPhone].filter(Boolean).join(' · ') || '—' }}</p>
        </section>

        <section v-if="registration.respondedAt" class="space-y-1">
          <h3 class="font-semibold text-gray-700">Allergies et intolérances</h3>
          <p class="whitespace-pre-line">{{ registration.dietary || 'Aucune déclarée' }}</p>
          <p v-if="registration.healthConsentAt" class="text-xs text-gray-500">
            Consentement donné le {{ formatLongDateTime(registration.healthConsentAt) }}
          </p>
        </section>

        <!-- Affinités rattachées aux personnes du jeu (US-095) : visibles de l'équipe seulement (R24) -->
        <section v-if="registration.respondedAt && (affinityGroups.length || refusedTypes.length)" class="space-y-2">
          <h3 class="font-semibold text-gray-700">Affinités</h3>
          <p class="text-xs text-gray-500">
            Rattachez chaque personne citée à une personne du jeu : la sélection signale alors qui ne veut pas se croiser.
          </p>
          <UAlert v-if="linkError" color="error" variant="soft" :description="linkError" />
          <!-- Cases de « les relations que je ne veux pas jouer » (US-099) -->
          <div v-if="refusedTypes.length" class="space-y-1">
            <p class="text-gray-600">Relations refusées (cases cochées)</p>
            <div class="flex flex-wrap gap-1">
              <UBadge v-for="type in refusedTypes" :key="type" color="neutral" variant="subtle">{{ refusedRelationLabel(type) }}</UBadge>
            </div>
          </div>
          <div v-for="group in affinityGroups" :key="group.key" class="space-y-1">
            <p class="text-gray-600">{{ group.label }}</p>
            <ul class="space-y-2 pl-2">
              <li v-for="line in group.lines" :key="line.id" class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span>{{ line.text }}</span>
                  <template v-if="line.linkable">
                    <UBadge v-if="line.target" color="primary" variant="subtle" icon="i-heroicons-link">{{ line.target.name }}</UBadge>
                    <UBadge v-else-if="line.targetUnknown" color="neutral" variant="outline">Hors du jeu</UBadge>
                    <UBadge v-else color="warning" variant="outline">À rattacher</UBadge>
                    <UButton v-if="line.target || line.targetUnknown" size="xs" color="neutral" variant="ghost" :disabled="linking" @click="link(line, {})">
                      Détacher
                    </UButton>
                  </template>
                </div>
                <div v-if="line.linkable && !line.target && !line.targetUnknown" class="flex flex-wrap items-center gap-2">
                  <UButton
                    v-for="person in line.suggestions"
                    :key="person.id"
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-heroicons-link"
                    :disabled="linking"
                    @click="link(line, { targetParticipantId: person.id })"
                  >
                    {{ person.name }}
                  </UButton>
                  <USelectMenu
                    size="xs"
                    class="w-48"
                    :items="peopleItems"
                    value-key="value"
                    placeholder="Autre personne du jeu…"
                    :disabled="linking"
                    @update:model-value="(id) => id && link(line, { targetParticipantId: id })"
                  />
                  <UButton size="xs" color="neutral" variant="ghost" :disabled="linking" @click="link(line, { unknown: true })">
                    Personne du jeu ne correspond
                  </UButton>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <!-- Question d'équilibre (US-091) -->
        <section v-if="registration.respondedAt && registration.balance" class="space-y-1">
          <h3 class="font-semibold text-gray-700">{{ registration.balance.label }} : préférence</h3>
          <p>{{ registration.balancePreference || 'Peu importe' }}</p>
        </section>

        <section v-if="registration.respondedAt && registration.questions.length" class="space-y-2">
          <h3 class="font-semibold text-gray-700">Questions</h3>
          <div v-for="question in registration.questions" :key="question.id">
            <p class="text-gray-600">{{ question.label }}</p>
            <p class="whitespace-pre-line">{{ answerText(question) }}</p>
            <!-- Rôles que désigne la réponse (US-098) -->
            <p v-if="answerTargets(question).length" class="text-xs text-gray-500">→ {{ answerTargets(question).join(', ') }}</p>
          </div>
        </section>

        <p v-if="!registration.respondedAt" class="text-gray-600">
          Pas encore de réponse au formulaire.
        </p>

        <section class="space-y-1 text-xs text-gray-500">
          <p v-if="registration.invitedBy">Invitée par {{ registration.invitedBy.name }}</p>
          <p v-if="registration.invitationSentAt">Invitation envoyée le {{ formatLongDateTime(registration.invitationSentAt) }}</p>
          <p v-if="registration.lastRemindedAt">Relancée le {{ formatLongDateTime(registration.lastRemindedAt) }}</p>
          <p v-if="registration.responseDueAt && registration.status === REGISTRATION_STATUSES.invited">Réponse attendue avant le {{ formatLongDateTime(registration.responseDueAt) }}</p>
          <p v-if="registration.respondedAt">Réponse le {{ formatLongDateTime(registration.respondedAt) }}</p>
          <p v-if="registration.charterAcceptedAt">Charte acceptée le {{ formatLongDateTime(registration.charterAcceptedAt) }}</p>
          <p v-if="registration.formVersion">Formulaire, version {{ registration.formVersion.number }}</p>
        </section>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { REGISTRATION_STATUSES } from '~/utils/domain'
import { REGISTRATION_AFFINITIES } from '~/utils/registrationForms'
import { refusedRelationLabel } from '~/utils/characterRelations'
import { registrationStatusMeta } from '~/utils/registrations'
import { formatLongDateTime } from '~/utils/dates'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

type RegistrationDetail = ApiResponse<'/api/registrations/:id'>
type AffinityLine = RegistrationDetail['affinityLines'][number]
type Question = RegistrationDetail['questions'][number]

// Détail d'une inscription (US-005) : réponses au formulaire, dont les allergies (données de santé, R14)
const props = withDefaults(defineProps<{ registrationId?: string | null }>(), { registrationId: null })
const open = defineModel<boolean>('open', { default: false })
// Un rattachement change les alertes de la sélection (US-096)
const emit = defineEmits<{ changed: [] }>()

const registration = ref<RegistrationDetail | null>(null)
const errorMessage = ref('')

const statusMeta = computed(() => registration.value ? registrationStatusMeta(registration.value) : { label: '', color: 'neutral' as const })

// Gardée sur l'appareil, allergies et affinités comprises, pour être lue hors ligne (US-120)
const load = (id: string) => useApiFetch(`/api/registrations/${id}`, { offlineCache: true })

watch([open, () => props.registrationId], async ([isOpen, id]) => {
  if (!isOpen || !id) return
  registration.value = null
  errorMessage.value = ''
  linkError.value = ''
  try {
    registration.value = await load(id)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Impossible de charger l’inscription')
  }
}, { immediate: true })

// Lignes rangées par sorte d'affinité, dans l'ordre du formulaire
const affinityGroups = computed(() => REGISTRATION_AFFINITIES
  .map(({ key, label }) => ({ key, label, lines: (registration.value?.affinityLines || []).filter((line) => line.kind === key) }))
  .filter((group) => group.lines.length))
const refusedTypes = computed(() => (registration.value?.affinityLines || [])
  .filter((line) => line.kind === 'refusedRelationTypes')
  .map((line) => line.text))

const TARGET_KINDS: Record<string, string> = { character: 'personnage', faction: 'faction', intrigue: 'intrigue' }
// Personnages, factions et intrigues reliés aux options choisies, ou à la question sur une échelle répondue (US-098)
function answerTargets(question: Question) {
  const answer = registration.value?.questionAnswers?.[question.id]
  if (answer === null || answer === undefined || answer === '') return []
  const chosen = question.type === 'scale' ? [''] : Array.isArray(answer) ? answer.map(String) : [String(answer)]
  return (registration.value?.questionLinks || [])
    .filter((link) => link.questionId === question.id && chosen.includes(link.option))
    .map((link) => `${link.target.name} (${TARGET_KINDS[link.target.kind]}${question.type === 'scale' ? `, note ${answer} / 5` : ''})`)
}
const peopleItems = computed(() => (registration.value?.gamePeople || []).map((person) => ({ label: person.name, value: person.id })))

const linking = ref(false)
const linkError = ref('')

// Rattacher, marquer « personne du jeu ne correspond » ou détacher (US-095), puis relire les suggestions
async function link(line: AffinityLine, body: { targetParticipantId?: string, unknown?: boolean }) {
  if (!props.registrationId) return
  linking.value = true
  linkError.value = ''
  try {
    await useApiAction(`/api/registration-affinities/${line.id}/link`, { method: 'POST', body })
    registration.value = await load(props.registrationId)
    emit('changed')
  } catch (err) {
    linkError.value = apiErrorMessage(err, 'Rattachement impossible')
  } finally {
    linking.value = false
  }
}

// Réponse à une question propre au jeu (US-081), lue avec la version du formulaire remplie
function answerText(question: Question) {
  const answer = registration.value?.questionAnswers?.[question.id]
  if (answer === null || answer === undefined || answer === '' || (Array.isArray(answer) && !answer.length)) return '—'
  if (Array.isArray(answer)) return answer.join(', ')
  return question.type === 'scale' ? `${answer} / 5` : String(answer)
}
</script>
