<template>
  <UModal v-model:open="open" :title="period?.id ? 'Modifier la période d’inscription' : 'Nouvelle période d’inscription'">
    <template #body>
      <form class="space-y-5" @submit.prevent="submit">
        <UFormField label="Nom" :error="errors.name">
          <UInput v-model="form.name" placeholder="Sessions du printemps" required class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Mode d’inscription" :description="period?.id ? 'Fixé à la création.' : undefined">
            <USelect v-model="form.entryMode" :items="ENTRY_MODE_ITEMS" value-key="value" :disabled="Boolean(period?.id)" class="w-full" @update:model-value="onEntryModeChange" />
          </UFormField>
          <UFormField v-if="form.entryMode === REGISTRATION_ENTRY_MODES.form" label="Portée" :description="period?.id ? 'Fixée à la création.' : undefined">
            <USelect v-model="form.scope" :items="SCOPE_ITEMS" value-key="value" :disabled="Boolean(period?.id)" class="w-full" />
          </UFormField>
        </div>
        <p v-if="permanent" class="text-sm text-gray-600">
          L’inscription permanente couvre toutes les sessions du jeu, présentes et futures, sauf celles qui ont leur propre période. Les personnes inscrites forment un vivier ; elle n’a pas de date de clôture : vous la clôturez à la main.
        </p>
        <AppCheckboxRow
          v-if="form.entryMode === REGISTRATION_ENTRY_MODES.form"
          v-model="form.notifyTeam"
          label="Me prévenir de chaque inscription reçue"
          description="La propriétaire et les co-organisatrices reçoivent un email pour chaque inscription dont l’adresse est confirmée."
        />
        <!-- Rejoueurs (R7, US-087) : personnes qui ont déjà joué une session terminée du jeu -->
        <UFormField
          v-if="form.entryMode === REGISTRATION_ENTRY_MODES.form"
          label="Personnes qui ont déjà joué le jeu"
          description="Signalées dans la sélection, ou exclues du tirage et du vivier ; on peut toujours les retenir à la main dans une période ordinaire."
        >
          <USelect v-model="form.replayPolicy" :items="REPLAY_POLICY_ITEMS" value-key="value" class="w-full" />
        </UFormField>

        <!-- Mode de sélection et tirage (US-092) : périodes ordinaires en mode formulaire -->
        <template v-if="form.entryMode === REGISTRATION_ENTRY_MODES.form && !permanent">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="Sélection">
              <USelect v-model="form.selectionMode" :items="SELECTION_MODE_ITEMS" value-key="value" class="w-full" />
            </UFormField>
            <UFormField
              v-if="form.selectionMode === REGISTRATION_SELECTION_MODES.mixed"
              label="Places choisies par organisatrice"
              description="Par session, avant le tirage."
              :error="errors.organizerPicks"
            >
              <UInput v-model.number="form.organizerPicks" type="number" min="0" max="1000" class="w-full" />
            </UFormField>
          </div>
          <template v-if="form.selectionMode !== REGISTRATION_SELECTION_MODES.chosen">
            <AppCheckboxRow
              v-model="form.weightNotDrawnBefore"
              label="Priorité aux personnes non retenues avant"
              description="Chances doublées pour qui n’a pas été retenu, ou est resté en attente, lors d’une autre période du jeu."
            />
            <AppCheckboxRow
              v-model="form.weightBalance"
              label="Équilibre selon l’attribut des personnages"
              description="Places réservées par valeur (par exemple le genre du personnage), au prorata des PJ, selon la question d’équilibre du formulaire."
            />
            <UFormField label="Liste d’attente après le tirage" description="Personnes mises en attente par session ; les suivantes sont non retenues." :error="errors.waitlistSize">
              <UInput v-model.number="form.waitlistSize" type="number" min="0" max="1000" class="w-full sm:w-40" />
            </UFormField>
          </template>
        </template>

        <UFormField v-if="!permanent" label="Sessions" :error="errors.sessions" description="Une session ne peut appartenir qu’à une seule période d’inscription.">
          <div class="space-y-2">
            <div
              v-for="session in context.sessions"
              :key="session.id"
              class="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <AppCheckboxRow
                class="flex-1"
                :model-value="isSelected(session.id)"
                :label="session.name"
                :description="sessionDescription(session)"
                :disabled="isTakenElsewhere(session)"
                @update:model-value="toggleSession(session.id, $event)"
              />
              <UFormField v-if="isSelected(session.id)" label="Places" class="sm:w-28">
                <UInput
                  v-model.number="seatsBySession[session.id]"
                  type="number"
                  min="0"
                  max="1000"
                  class="w-full"
                />
              </UFormField>
            </div>
            <p v-if="!context.sessions.length" class="text-sm text-gray-500">
              Ce jeu n’a pas encore de session : créez-en une avant d’ouvrir les inscriptions.
            </p>
          </div>
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField v-if="!permanent" label="Clôture" description="Facultative : la période se clôture d’elle-même à cette date." :error="errors.closesAt">
            <UInput v-model="form.closesAt" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField label="Délai de réponse (jours)" description="Accordé à chaque personne invitée ou retenue." :error="errors.responseDelayDays">
            <UInput v-model.number="form.responseDelayDays" type="number" min="1" max="90" required class="w-full" />
          </UFormField>
        </div>

        <UAlert
          v-if="serverError"
          color="error"
          variant="soft"
          :description="serverError"
        />

        <div class="flex flex-wrap gap-2">
          <UButton type="submit" color="primary" :loading="saving">
            {{ period?.id ? 'Enregistrer' : 'Créer' }}
          </UButton>
          <UButton type="button" color="neutral" variant="soft" @click="open = false">
            Annuler
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import {
  REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS,
  REGISTRATION_ENTRY_MODES,
  REGISTRATION_PERIOD_SCOPES,
  REGISTRATION_PERIOD_STATES,
  REGISTRATION_DEFAULT_WAITLIST_SIZE,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_REPLAY_POLICY_OPTIONS,
  REGISTRATION_SELECTION_MODE_OPTIONS,
  REGISTRATION_SELECTION_MODES
} from '~/utils/domain'
import { apiErrorMessage } from '~/utils/apiErrors'
import { formatLongDate } from '~/utils/dates'
import { toDatetimeLocal } from '~/utils/sessions'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'

type Context = ApiResponse<'/api/games/:id/registration-context'>
type ContextSession = Context['sessions'][number]
// Un champ nombre vidé rend une chaîne vide : la validation le refuse
type Count = number | ''

type SelectItem = { value: string, label: string }

const ENTRY_MODE_ITEMS: SelectItem[] = [
  { value: REGISTRATION_ENTRY_MODES.invitation, label: 'Sur invitation' },
  { value: REGISTRATION_ENTRY_MODES.form, label: 'Formulaire public' }
]
const REPLAY_POLICY_ITEMS: SelectItem[] = [...REGISTRATION_REPLAY_POLICY_OPTIONS]
const SELECTION_MODE_ITEMS: SelectItem[] = [...REGISTRATION_SELECTION_MODE_OPTIONS]
const SCOPE_ITEMS: SelectItem[] = [
  { value: REGISTRATION_PERIOD_SCOPES.sessions, label: 'Des sessions précises' },
  { value: REGISTRATION_PERIOD_SCOPES.game, label: 'Tout le jeu (inscription permanente)' }
]

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(defineProps<{
  gameId: string
  // Période à modifier, ou null pour en créer une
  period?: RegistrationPeriod | null
}>(), { period: null })

const emit = defineEmits<{ saved: [] }>()

const form = ref(emptyForm())
const seatsBySession = ref<Record<string, Count>>({})
const context = ref<Context>({ sessions: [], playableCharacters: 0 })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const saving = ref(false)

watch(open, async (value) => {
  if (!value) return
  errors.value = {}
  serverError.value = ''
  try {
    context.value = await useApiFetch(`/api/games/${props.gameId}/registration-context`)
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Impossible de charger les sessions du jeu')
  }
  resetForm()
})

// Inscription permanente : sans sessions ni date de clôture (R30)
const permanent = computed(() => form.value.scope === REGISTRATION_PERIOD_SCOPES.game)
const drawSettingsApply = computed(() => form.value.entryMode === REGISTRATION_ENTRY_MODES.form && !permanent.value)
const isCount = (value: Count) => value !== '' && Number.isInteger(value) && value >= 0 && value <= 1000

function onEntryModeChange(mode: string) {
  if (mode !== REGISTRATION_ENTRY_MODES.form) form.value.scope = REGISTRATION_PERIOD_SCOPES.sessions
}

function emptyForm() {
  return {
    name: '',
    entryMode: REGISTRATION_ENTRY_MODES.invitation as string,
    scope: REGISTRATION_PERIOD_SCOPES.sessions as string,
    notifyTeam: false,
    replayPolicy: REGISTRATION_REPLAY_POLICIES.allowed as string,
    selectionMode: REGISTRATION_SELECTION_MODES.chosen as string,
    organizerPicks: 0 as Count,
    weightNotDrawnBefore: false,
    weightBalance: false,
    waitlistSize: REGISTRATION_DEFAULT_WAITLIST_SIZE as Count,
    closesAt: '',
    responseDelayDays: REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS as Count,
    state: REGISTRATION_PERIOD_STATES.draft as string,
    updatedAt: null as string | null
  }
}

function resetForm() {
  const period = props.period
  if (!period) {
    form.value = emptyForm()
    seatsBySession.value = {}
    return
  }

  form.value = {
    name: period.name,
    entryMode: period.entryMode,
    scope: period.scope,
    notifyTeam: period.notifyTeam,
    replayPolicy: period.replayPolicy || REGISTRATION_REPLAY_POLICIES.allowed,
    selectionMode: period.selectionMode || REGISTRATION_SELECTION_MODES.chosen,
    organizerPicks: period.organizerPicks ?? 0,
    weightNotDrawnBefore: period.weightNotDrawnBefore,
    weightBalance: period.weightBalance,
    waitlistSize: period.waitlistSize ?? REGISTRATION_DEFAULT_WAITLIST_SIZE,
    closesAt: toDatetimeLocal(period.closesAt),
    responseDelayDays: period.responseDelayDays,
    state: period.state,
    updatedAt: period.updatedAt
  }
  seatsBySession.value = Object.fromEntries(period.sessions.map((link) => [link.sessionId, link.seats]))
}

function isSelected(sessionId: string) {
  return Object.hasOwn(seatsBySession.value, sessionId)
}

function isTakenElsewhere(session: ContextSession) {
  return Boolean(session.periodId) && session.periodId !== props.period?.id
}

function toggleSession(sessionId: string, selected: boolean) {
  if (selected) {
    // Places proposées par défaut : le nombre de personnages PJ du jeu (R5)
    seatsBySession.value = { ...seatsBySession.value, [sessionId]: context.value.playableCharacters }
  } else {
    seatsBySession.value = Object.fromEntries(Object.entries(seatsBySession.value).filter(([id]) => id !== sessionId))
  }
}

function sessionDescription(session: ContextSession) {
  const parts = []
  if (session.date) parts.push(formatLongDate(session.date))
  if (isTakenElsewhere(session)) parts.push(`déjà dans « ${session.periodName} »`)
  return parts.join(' · ')
}

function validate() {
  const found: Record<string, string> = {}
  if (!form.value.name.trim()) found.name = 'Le nom est requis.'
  // Un champ vidé n'est pas « nombre de PJ par défaut » : on demande une valeur explicite
  if (!permanent.value && !Object.keys(seatsBySession.value).length) found.sessions = 'Choisissez au moins une session.'
  else if (!permanent.value && !Object.values(seatsBySession.value).every(isCount)) {
    found.sessions = 'Indiquez pour chaque session un nombre de places entre 0 et 1000.'
  }
  const drawn = drawSettingsApply.value
  if (drawn && form.value.selectionMode === REGISTRATION_SELECTION_MODES.mixed && !isCount(form.value.organizerPicks)) found.organizerPicks = 'Un nombre entre 0 et 1000.'
  if (drawn && form.value.selectionMode !== REGISTRATION_SELECTION_MODES.chosen && !isCount(form.value.waitlistSize)) found.waitlistSize = 'Un nombre entre 0 et 1000.'
  const delay = Number(form.value.responseDelayDays)
  if (!Number.isInteger(delay) || delay < 1 || delay > 90) found.responseDelayDays = 'Entre 1 et 90 jours.'
  errors.value = found
  return Object.keys(found).length === 0
}

async function submit() {
  if (!validate()) return

  saving.value = true
  serverError.value = ''
  try {
    const body = {
      name: form.value.name,
      gameId: props.gameId,
      ...(props.period?.id ? {} : { entryMode: form.value.entryMode, scope: form.value.scope }),
      notifyTeam: form.value.entryMode === REGISTRATION_ENTRY_MODES.form && form.value.notifyTeam,
      replayPolicy: form.value.replayPolicy,
      // Le tirage ne concerne que les périodes ordinaires en mode formulaire
      selectionMode: drawSettingsApply.value ? form.value.selectionMode : REGISTRATION_SELECTION_MODES.chosen,
      organizerPicks: drawSettingsApply.value && form.value.selectionMode === REGISTRATION_SELECTION_MODES.mixed ? Number(form.value.organizerPicks) : null,
      weightNotDrawnBefore: drawSettingsApply.value && form.value.weightNotDrawnBefore,
      weightBalance: drawSettingsApply.value && form.value.weightBalance,
      waitlistSize: Number(form.value.waitlistSize),
      state: form.value.state,
      closesAt: !permanent.value && form.value.closesAt ? new Date(form.value.closesAt).toISOString() : null,
      responseDelayDays: Number(form.value.responseDelayDays),
      sessions: permanent.value ? [] : Object.entries(seatsBySession.value).map(([sessionId, seats]) => ({ sessionId, seats })),
      updatedAt: form.value.updatedAt
    }
    if (props.period?.id) await useApiAction(`/api/registration-periods/${props.period.id}`, { method: 'PUT', body })
    else await useApiAction('/api/registration-periods', { method: 'POST', body })
    emit('saved')
    open.value = false
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Enregistrement impossible')
  } finally {
    saving.value = false
  }
}
</script>
