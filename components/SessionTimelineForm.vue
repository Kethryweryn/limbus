<template>
  <UCard>
    <template #header>
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 class="font-semibold">Timeline de session</h2>
          <p class="text-sm text-gray-500">{{ events.length }} événement(s)</p>
        </div>
        <UButton color="primary" :loading="saving" :disabled="saving" @click="submit">
          Enregistrer la timeline
        </UButton>
      </div>
    </template>

    <div v-if="events.length" class="space-y-6">
      <UAlert
        v-if="!eligibleResponsibles.length"
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        title="Aucun responsable disponible"
        description="Ajoutez des organisateurs ou des PNJs à la session pour assigner la timeline."
      />

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <article
          v-for="timelineEvent in events"
          :key="timelineEvent.id"
          class="rounded border border-gray-200 p-4 space-y-3"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div class="text-sm text-gray-500">Jour {{ timelineEvent.day }} · {{ timelineEvent.time }}</div>
              <h3 class="font-semibold">{{ timelineEvent.name }}</h3>
            </div>
            <UBadge :color="responsibleColor(timelineEvent)" variant="subtle">
              {{ selectedResponsibleIds(timelineEvent.id).length }}/{{ timelineEvent.requiredResponsibles || 0 }}
            </UBadge>
          </div>

          <USelectMenu
            v-model="assignments[timelineEvent.id]"
            :items="responsibleOptions"
            value-key="value"
            multiple
            :disabled="!responsibleOptions.length"
            placeholder="Assigner des responsables"
            class="w-full"
          />
        </article>
      </div>

      <div class="overflow-x-auto rounded border border-gray-200">
        <table class="min-w-full border-collapse text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-3 py-2 text-left font-medium min-w-48">
                Responsable
              </th>
              <th
                v-for="timelineEvent in events"
                :key="timelineEvent.id"
                class="border-r border-gray-200 px-3 py-2 text-left font-medium min-w-44"
              >
                <div>J{{ timelineEvent.day }} · {{ timelineEvent.time }}</div>
                <div class="text-xs text-gray-500 font-normal line-clamp-2">{{ timelineEvent.name }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="responsible in eligibleResponsibles" :key="responsible.participantId">
              <td class="sticky left-0 z-10 bg-white border-t border-r border-gray-200 px-3 py-2 font-medium">
                <div>{{ responsible.participant?.name || 'Participant inconnu' }}</div>
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ responsible.role === 'organizer' ? 'Orga' : 'PNJ' }}
                </UBadge>
              </td>
              <td
                v-for="timelineEvent in events"
                :key="timelineEvent.id"
                class="border-t border-r border-gray-200 px-3 py-2 align-top"
                :class="isResponsibleAssigned(timelineEvent.id, responsible.participantId) ? 'bg-primary-50' : ''"
              >
                <span v-if="isResponsibleAssigned(timelineEvent.id, responsible.participantId)" class="font-medium">
                  {{ timelineEvent.name }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="rounded border border-dashed border-gray-300 p-6 text-sm text-gray-500">
      Aucun événement de timeline pour ce jeu.
    </div>

    <p v-if="serverError" class="text-red-500 text-sm mt-4">{{ serverError }}</p>
  </UCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  timelineData: { type: Object, required: true },
  onSave: { type: Function, required: true }
})

const saving = ref(false)
const serverError = ref('')
const assignments = ref({})

const events = computed(() => props.timelineData.events || [])

const eligibleResponsibles = computed(() =>
  (props.timelineData.session?.participants || [])
    .filter((participant) => participant.role === 'organizer' || participant.role === 'npc')
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'organizer' ? -1 : 1
      return (a.participant?.name || '').localeCompare(b.participant?.name || '')
    })
)

const responsibleOptions = computed(() =>
  eligibleResponsibles.value.map((responsible) => ({
    label: `${responsible.role === 'organizer' ? 'Orga' : 'PNJ'} - ${responsible.participant?.name || 'Participant inconnu'}`,
    value: responsible.participantId || responsible.participant?.id
  }))
)

watch(() => props.timelineData, (value) => {
  const nextAssignments = {}
  for (const timelineEvent of value.events || []) {
    nextAssignments[timelineEvent.id] = (timelineEvent.responsibles || [])
      .map((responsible) => responsible.participantId || responsible.participant?.id)
      .filter(Boolean)
  }
  assignments.value = nextAssignments
}, { immediate: true, deep: true })

function selectedResponsibleIds(timelineEventId) {
  return assignments.value[timelineEventId] || []
}

function isResponsibleAssigned(timelineEventId, participantId) {
  return selectedResponsibleIds(timelineEventId).includes(participantId)
}

function responsibleColor(timelineEvent) {
  if (!timelineEvent.requiredResponsibles) return 'neutral'
  return selectedResponsibleIds(timelineEvent.id).length >= timelineEvent.requiredResponsibles ? 'success' : 'warning'
}

async function submit() {
  if (saving.value) return

  saving.value = true
  try {
    await props.onSave(events.value.map((timelineEvent) => ({
      timelineEventId: timelineEvent.id,
      participantIds: selectedResponsibleIds(timelineEvent.id)
    })))
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    saving.value = false
  }
}
</script>
