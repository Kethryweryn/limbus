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

      <div class="overflow-x-auto rounded border border-gray-200">
        <table class="min-w-full border-collapse text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-3 py-2 text-left font-medium min-w-48">
                Heure
              </th>
              <th
                v-for="responsible in eligibleResponsibles"
                :key="responsible.participantId"
                class="border-r border-gray-200 px-3 py-2 text-left font-medium min-w-64"
              >
                <div>{{ responsible.participant?.name || 'Participant inconnu' }}</div>
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ responsible.role === SESSION_ROLES.organizer ? 'Orga' : 'PNJ' }}
                </UBadge>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="slot in timelineSlots" :key="`${slot.day}-${slot.time}`">
              <td class="sticky left-0 z-10 bg-white border-t border-r border-gray-200 px-3 py-2 font-medium">
                <div>Jour {{ slot.day }}</div>
                <div class="text-gray-500">{{ slot.time }}</div>
              </td>
              <td
                v-for="responsible in eligibleResponsibles"
                :key="`${slot.day}-${slot.time}-${responsible.participantId}`"
                class="border-t border-r border-gray-200 p-2 align-top"
              >
                <div class="space-y-2">
                  <article
                    v-for="timelineEvent in eventsForSlot(slot)"
                    :key="timelineEvent.id"
                    class="rounded border p-2 transition"
                    :class="isResponsibleAssigned(timelineEvent.id, responsible.participantId) ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50 opacity-70'"
                    @click="toggleResponsible(timelineEvent.id, responsible.participantId, !isResponsibleAssigned(timelineEvent.id, responsible.participantId))"
                  >
                    <div class="flex items-start gap-2">
                      <UCheckbox
                        :model-value="isResponsibleAssigned(timelineEvent.id, responsible.participantId)"
                        :disabled="!responsibleOptions.length"
                        :aria-label="`Assigner ${responsible.participant?.name || 'ce responsable'} à ${timelineEvent.name}`"
                        @click.stop
                        @update:model-value="toggleResponsible(timelineEvent.id, responsible.participantId, $event)"
                      />
                      <div class="min-w-0 flex-1 space-y-2">
                        <div class="flex items-start justify-between gap-2">
                          <div class="font-medium leading-tight">{{ timelineEvent.name }}</div>
                          <div class="flex shrink-0 items-center gap-1">
                            <UBadge :color="responsibleColor(timelineEvent)" variant="subtle" size="xs">
                              {{ selectedResponsibleIds(timelineEvent.id).length }}/{{ timelineEvent.requiredResponsibles || 0 }}
                            </UBadge>
                            <UButton
                              :to="eventDetailTo(timelineEvent)"
                              icon="i-heroicons-eye"
                              color="neutral"
                              variant="ghost"
                              size="xs"
                              aria-label="Voir le détail de l’événement"
                              @click.stop="rememberSessionTimelineContext(timelineEvent)"
                            />
                          </div>
                        </div>
                        <div v-if="eventBadgeSummary(timelineEvent).badges.length" class="flex flex-wrap gap-1">
                          <UBadge
                            v-for="badge in eventBadgeSummary(timelineEvent).badges"
                            :key="`${timelineEvent.id}-${badge.type}-${badge.id}`"
                            :color="badge.color"
                            variant="subtle"
                            size="xs"
                            class="max-w-full truncate"
                          >
                            {{ badge.label }}
                          </UBadge>
                        </div>
                        <div v-else-if="eventBadgeSummary(timelineEvent).summary" class="text-xs text-gray-500">
                          {{ eventBadgeSummary(timelineEvent).summary }}
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
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
import { SESSION_ROLES } from '~/utils/domain'

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
    .filter((participant) => participant.role === SESSION_ROLES.organizer || participant.role === SESSION_ROLES.npc)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === SESSION_ROLES.organizer ? -1 : 1
      return (a.participant?.name || '').localeCompare(b.participant?.name || '')
    })
)

const responsibleOptions = computed(() =>
  eligibleResponsibles.value.map((responsible) => ({
    label: `${responsible.role === SESSION_ROLES.organizer ? 'Orga' : 'PNJ'} - ${responsible.participant?.name || 'Participant inconnu'}`,
    value: responsible.participantId || responsible.participant?.id
  }))
)

const timelineSlots = computed(() => {
  const slotByKey = new Map()
  for (const timelineEvent of events.value) {
    const key = `${timelineEvent.day}-${timelineEvent.time}`
    if (!slotByKey.has(key)) {
      slotByKey.set(key, { day: timelineEvent.day, time: timelineEvent.time })
    }
  }

  return [...slotByKey.values()].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
})

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

function eventsForSlot(slot) {
  return events.value.filter((timelineEvent) => timelineEvent.day === slot.day && timelineEvent.time === slot.time)
}

function toggleResponsible(timelineEventId, participantId, checked) {
  const current = new Set(selectedResponsibleIds(timelineEventId))
  if (checked) {
    current.add(participantId)
  } else {
    current.delete(participantId)
  }
  assignments.value = {
    ...assignments.value,
    [timelineEventId]: [...current]
  }
}

function responsibleColor(timelineEvent) {
  if (!timelineEvent.requiredResponsibles) return 'neutral'
  return selectedResponsibleIds(timelineEvent.id).length >= timelineEvent.requiredResponsibles ? 'success' : 'warning'
}

function eventBadgeSummary(timelineEvent) {
  const badges = [
    ...(timelineEvent.characters || []).map((character) => ({
      id: character.id,
      type: 'character',
      label: character.name,
      color: 'neutral'
    })),
    ...(timelineEvent.factions || []).map((faction) => ({
      id: faction.id,
      type: 'faction',
      label: faction.name,
      color: 'warning'
    })),
    ...(timelineEvent.items || []).map((item) => ({
      id: item.id,
      type: 'item',
      label: item.name,
      color: 'success'
    }))
  ]

  if (badges.length < 5) {
    return { badges, summary: '' }
  }

  return {
    badges: [],
    summary: `${timelineEvent.characters?.length || 0} personnage(s), ${timelineEvent.factions?.length || 0} groupe(s), ${timelineEvent.items?.length || 0} objet(s)`
  }
}

function eventDetailTo(timelineEvent) {
  return {
    path: `/timeline/${timelineEvent.slug || timelineEvent.id}`
  }
}

function rememberSessionTimelineContext(timelineEvent) {
  if (!import.meta.client || !props.timelineData.session?.id) return
  sessionStorage.setItem('limbus:timeline-return-context', JSON.stringify({
    source: 'session',
    sessionId: props.timelineData.session.id,
    eventId: timelineEvent.id
  }))
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
