<template>
  <UCard>
    <template #header>
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold">Confirmation de présence</h2>
        <p class="text-sm text-gray-500">
          Report de « {{ data?.postponedFrom?.name || 'la session' }} » : chaque personne de l’équipe confirme qu’elle viendra à la nouvelle date.
        </p>
      </div>
    </template>

    <div class="space-y-6">
      <section v-if="pendingTeam" class="space-y-3 rounded border border-gray-200 p-4">
        <h3 class="font-medium">
          {{ data?.sent ? `Demander aux ${pendingTeam} personne(s) ajoutée(s) ou revenue(s) depuis` : `Demander à l’équipe (${data?.team || 0} personne(s))` }}
        </h3>
        <UFormField label="Date limite de réponse">
          <UInput v-model="dueDate" type="date" :min="tomorrow" class="w-full md:w-56" />
        </UFormField>
        <details class="text-sm">
          <summary class="cursor-pointer text-gray-600">Aperçu de l’email</summary>
          <pre class="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-3 font-sans text-gray-700">{{ preview }}</pre>
        </details>
        <UButton color="primary" :loading="sending" :disabled="sending || !dueDate" @click="send">
          Envoyer les demandes
        </UButton>
      </section>

      <div v-if="rows.length" class="flex flex-wrap gap-2 text-sm">
        <UBadge v-for="badge in countBadges" :key="badge.status" :color="badge.color" variant="subtle">
          {{ badge.label }} : {{ badge.count }}
        </UBadge>
      </div>

      <article v-for="row in rows" :key="row.participant.id" class="space-y-2 border-t border-gray-100 pt-3">
        <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div class="text-sm">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{{ row.participant.name }}</span>
              <UBadge :color="ATTENDANCE_DISPLAY[row.displayStatus].color" variant="subtle" size="xs">
                {{ ATTENDANCE_DISPLAY[row.displayStatus].label }}
              </UBadge>
            </div>
            <div class="text-gray-500">
              <span v-if="!row.participant.email">Sans email · </span>
              <span v-else-if="row.invitationSentAt">Demandé le {{ formatDate(row.invitationSentAt) }} · </span>
              <span v-else>Demande non partie · </span>
              <span>avant le {{ formatDate(row.responseDueAt) }}</span>
              <span v-if="row.lastRemindedAt"> · relancé le {{ formatDate(row.lastRemindedAt) }}</span>
              <span v-if="row.respondedAt"> · répondu le {{ formatDate(row.respondedAt) }}</span>
            </div>
          </div>
          <div v-if="row.status !== ATTENDANCE_STATUSES.released" class="flex flex-wrap gap-2">
            <UButton
              v-if="row.status === ATTENDANCE_STATUSES.pending && row.invitationSentAt && row.participant.email"
              size="xs" color="neutral" variant="soft" :loading="busy === `remind:${row.participant.id}`" :disabled="Boolean(busy)"
              @click="act(row, 'remind')"
            >
              Relancer
            </UButton>
            <UButton
              v-if="row.participant.email"
              size="xs" color="neutral" variant="soft" :loading="busy === `resend:${row.participant.id}`" :disabled="Boolean(busy)"
              @click="act(row, 'resend', 'Envoyer un nouveau lien ? L’ancien cessera de fonctionner.')"
            >
              Nouveau lien
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" :disabled="Boolean(busy)" @click="toggleExtend(row)">
              Prolonger
            </UButton>
            <UButton
              v-if="row.canRelease"
              size="xs" color="error" variant="soft" :loading="busy === `release:${row.participant.id}`" :disabled="Boolean(busy)"
              @click="act(row, 'release', `Libérer la place de ${row.participant.name} ? Cette personne quitte l’équipe, le casting et le déroulé de la session.`)"
            >
              Libérer la place
            </UButton>
          </div>
        </div>
        <div v-if="extendingId === row.participant.id" class="flex flex-wrap items-end gap-2">
          <UFormField label="Nouvelle date limite">
            <UInput v-model="extendDate" type="date" :min="tomorrow" />
          </UFormField>
          <UButton size="sm" color="primary" :disabled="!extendDate || Boolean(busy)" @click="extend(row)">Enregistrer</UButton>
        </div>
      </article>

      <p v-if="message" class="text-sm text-gray-700">{{ message }}</p>
      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { ATTENDANCE_DISPLAY, ATTENDANCE_STATUSES, DEFAULT_ATTENDANCE_DELAY_DAYS, attendanceInvitationEmailText } from '~/utils/attendance'

import { apiErrorMessage } from '~/utils/apiErrors'
import { formatLongDate as formatDate } from '~/utils/dates'
import type { ApiResponse } from '~/composables/useApiFetch'

type Attendance = ApiResponse<'/api/sessions/:id/attendance'>
type AttendanceRow = Attendance['rows'][number]

// Confirmation de présence à une session reportée (US-024)
const props = defineProps<{
  session: { id: string, name: string, date?: string | null, game?: { title: string } | null, location?: { name: string } | null }
}>()
const emit = defineEmits<{ changed: [] }>()

const DAY_MS = 24 * 60 * 60 * 1000
const toDateInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
// Fin de la journée choisie, à l'heure locale
const endOfDay = (value: string) => new Date(`${value}T23:59:59`).toISOString()

const data = ref<Attendance | null>(null)
const dueDate = ref(toDateInput(new Date(Date.now() + DEFAULT_ATTENDANCE_DELAY_DAYS * DAY_MS)))
const tomorrow = toDateInput(new Date(Date.now() + DAY_MS))
const sending = ref(false)
const busy = ref('')
const extendingId = ref('')
const extendDate = ref('')
const message = ref('')
const error = ref('')

const rows = computed(() => data.value?.rows || [])
const pendingTeam = computed(() => data.value?.notAsked || 0)
// Décompte par état, dans l'ordre des états
const countBadges = computed(() => (Object.keys(ATTENDANCE_DISPLAY) as Array<keyof typeof ATTENDANCE_DISPLAY>)
  .map((status) => ({ status, ...ATTENDANCE_DISPLAY[status], count: rows.value.filter((row) => row.displayStatus === status).length }))
  .filter((badge) => badge.count))


const preview = computed(() => attendanceInvitationEmailText({
  participantName: 'Prénom Nom',
  gameTitle: props.session.game?.title || 'Jeu',
  previousSessionName: data.value?.postponedFrom?.name || null,
  sessionName: props.session.name,
  sessionDate: props.session.date ?? null,
  locationName: props.session.location?.name || null,
  responseDueAt: dueDate.value ? endOfDay(dueDate.value) : new Date(),
  url: 'https://… (lien personnel)'
}))

async function load() {
  data.value = await useApiFetch(`/api/sessions/${props.session.id}/attendance`, { offlineCache: true })
}

onMounted(load)
watch(() => props.session.id, load)

function report(err: unknown, fallback: string) {
  error.value = apiErrorMessage(err, fallback)
}

async function send() {
  if (!confirm('Envoyer les demandes de confirmation de présence ?')) return
  sending.value = true
  message.value = ''
  error.value = ''
  try {
    const result = await useApiAction(`/api/sessions/${props.session.id}/attendance/send`, {
      method: 'POST',
      body: { responseDueAt: endOfDay(dueDate.value) }
    })
    message.value = [
      `${result.sentCount} demande(s) envoyée(s).`,
      result.withoutEmail.length ? `Sans email : ${result.withoutEmail.join(', ')}.` : '',
      result.failures.length ? `Non envoyées : ${result.failures.join(', ')}.` : ''
    ].filter(Boolean).join(' ')
    await load()
  } catch (err) {
    report(err, 'Impossible d’envoyer les demandes')
  } finally {
    sending.value = false
  }
}

async function act(row: AttendanceRow, action: 'remind' | 'resend' | 'release', confirmation?: string) {
  if (confirmation && !confirm(confirmation)) return
  busy.value = `${action}:${row.participant.id}`
  message.value = ''
  error.value = ''
  try {
    const result = await useApiAction(`/api/sessions/${props.session.id}/attendance/${row.participant.id}/${action}`, { method: 'POST' })
    const trombinoscopes = 'trombinoscopes' in result ? result.trombinoscopes : null
    if (trombinoscopes === 'regenerated') message.value = 'Place libérée ; les trombinoscopes de la session ont été régénérés.'
    if (trombinoscopes === 'failed') message.value = 'Place libérée, mais les trombinoscopes n’ont pas pu être régénérés : générez-les à nouveau.'
    await load()
    // Une place libérée change l'équipe et le casting de la session
    if (action === 'release') emit('changed')
  } catch (err) {
    report(err, 'Action impossible')
  } finally {
    busy.value = ''
  }
}

function toggleExtend(row: AttendanceRow) {
  extendingId.value = extendingId.value === row.participant.id ? '' : row.participant.id
  extendDate.value = ''
}

async function extend(row: AttendanceRow) {
  busy.value = `extend:${row.participant.id}`
  error.value = ''
  try {
    await useApiAction(`/api/sessions/${props.session.id}/attendance/${row.participant.id}/extend`, {
      method: 'POST',
      body: { responseDueAt: endOfDay(extendDate.value) }
    })
    extendingId.value = ''
    await load()
  } catch (err) {
    report(err, 'Impossible de prolonger')
  } finally {
    busy.value = ''
  }
}
</script>
