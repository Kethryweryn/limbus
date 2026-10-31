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

<script setup>
import { REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS, REGISTRATION_ENTRY_MODES, REGISTRATION_PERIOD_SCOPES, REGISTRATION_PERIOD_STATES } from '~/utils/domain'
import { apiErrorMessage } from '~/utils/apiErrors'

const ENTRY_MODE_ITEMS = [
  { value: REGISTRATION_ENTRY_MODES.invitation, label: 'Sur invitation' },
  { value: REGISTRATION_ENTRY_MODES.form, label: 'Formulaire public' }
]
const SCOPE_ITEMS = [
  { value: REGISTRATION_PERIOD_SCOPES.sessions, label: 'Des sessions précises' },
  { value: REGISTRATION_PERIOD_SCOPES.game, label: 'Tout le jeu (inscription permanente)' }
]

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  gameId: { type: String, required: true },
  // Période à modifier, ou null pour en créer une
  period: { type: Object, default: null }
})

const emit = defineEmits(['saved'])

const form = ref(emptyForm())
const seatsBySession = ref({})
const context = ref({ sessions: [], playableCharacters: 0 })
const errors = ref({})
const serverError = ref('')
const saving = ref(false)

watch(open, async (value) => {
  if (!value) return
  errors.value = {}
  serverError.value = ''
  try {
    context.value = await useApiFetch(`/api/games/${props.gameId}/registration-context`)
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Impossible de charger les sessions du jeu'
  }
  resetForm()
})

// Inscription permanente : sans sessions ni date de clôture (R30)
const permanent = computed(() => form.value.scope === REGISTRATION_PERIOD_SCOPES.game)

function onEntryModeChange(mode) {
  if (mode !== REGISTRATION_ENTRY_MODES.form) form.value.scope = REGISTRATION_PERIOD_SCOPES.sessions
}

function emptyForm() {
  return {
    name: '',
    entryMode: REGISTRATION_ENTRY_MODES.invitation,
    scope: REGISTRATION_PERIOD_SCOPES.sessions,
    notifyTeam: false,
    closesAt: '',
    responseDelayDays: REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS,
    state: REGISTRATION_PERIOD_STATES.draft,
    updatedAt: null
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
    notifyTeam: Boolean(period.notifyTeam),
    closesAt: toDateTimeLocal(period.closesAt),
    responseDelayDays: period.responseDelayDays,
    state: period.state,
    updatedAt: period.updatedAt
  }
  seatsBySession.value = Object.fromEntries(period.sessions.map((link) => [link.sessionId, link.seats]))
}

function isSelected(sessionId) {
  return Object.hasOwn(seatsBySession.value, sessionId)
}

function isTakenElsewhere(session) {
  return Boolean(session.periodId) && session.periodId !== props.period?.id
}

function toggleSession(sessionId, selected) {
  if (selected) {
    // Places proposées par défaut : le nombre de personnages PJ du jeu (R5)
    seatsBySession.value = { ...seatsBySession.value, [sessionId]: context.value.playableCharacters }
  } else {
    seatsBySession.value = Object.fromEntries(Object.entries(seatsBySession.value).filter(([id]) => id !== sessionId))
  }
}

function sessionDescription(session) {
  const parts = []
  if (session.date) parts.push(new Date(session.date).toLocaleDateString('fr-FR', { dateStyle: 'long' }))
  if (isTakenElsewhere(session)) parts.push(`déjà dans « ${session.periodName} »`)
  return parts.join(' · ')
}

// <input type="datetime-local"> attend l'heure locale sans fuseau ; le serveur reçoit de l'ISO
function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function validate() {
  errors.value = {}
  if (!form.value.name?.trim()) errors.value.name = 'Le nom est requis.'
  if (permanent.value) {
    // Pas de sessions à vérifier
  } else if (!Object.keys(seatsBySession.value).length) errors.value.sessions = 'Choisissez au moins une session.'
  // Un champ vidé n'est pas « nombre de PJ par défaut » : on demande une valeur explicite
  else if (Object.values(seatsBySession.value).some((seats) => !Number.isInteger(seats) || seats < 0 || seats > 1000)) {
    errors.value.sessions = 'Indiquez pour chaque session un nombre de places entre 0 et 1000.'
  }
  const delay = Number(form.value.responseDelayDays)
  if (!Number.isInteger(delay) || delay < 1 || delay > 90) errors.value.responseDelayDays = 'Entre 1 et 90 jours.'
  return Object.keys(errors.value).length === 0
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
      state: form.value.state,
      closesAt: !permanent.value && form.value.closesAt ? new Date(form.value.closesAt).toISOString() : null,
      responseDelayDays: Number(form.value.responseDelayDays),
      sessions: permanent.value ? [] : Object.entries(seatsBySession.value).map(([sessionId, seats]) => ({ sessionId, seats })),
      updatedAt: form.value.updatedAt
    }
    const saved = props.period?.id
      ? await useApiFetch(`/api/registration-periods/${props.period.id}`, { method: 'PUT', body })
      : await useApiFetch('/api/registration-periods', { method: 'POST', body })
    emit('saved', saved)
    open.value = false
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Enregistrement impossible')
  } finally {
    saving.value = false
  }
}
</script>
