<template>
  <!-- Vue chronologique de la timeline (US-115) : une colonne par jour, une ligne par horaire -->
  <UCard>
    <template #header>
      <div>
        <h2 class="font-semibold">Vue chronologique</h2>
        <p class="text-sm text-gray-500">Timeline abstraite du jeu, organisée par jour et par horaire.</p>
      </div>
    </template>

    <div class="overflow-x-auto">
      <div
        class="min-w-[52rem] grid rounded border border-gray-200 bg-white text-sm"
        :style="{ gridTemplateColumns: `7rem repeat(${days.length}, minmax(14rem, 1fr))` }"
      >
        <div class="sticky left-0 z-20 border-r border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium">
          Horaire
        </div>
        <div
          v-for="day in days"
          :key="`header-${day}`"
          class="border-r border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium"
        >
          Jour {{ day }}
        </div>

        <template v-for="time in times" :key="time">
          <div class="sticky left-0 z-10 border-r border-b border-gray-200 bg-white px-3 py-3 font-medium">
            {{ time }}
          </div>
          <div
            v-for="day in days"
            :key="`${day}-${time}`"
            class="min-h-28 border-r border-b border-gray-200 p-2"
          >
            <button
              v-for="timelineEvent in eventsForSlot(day, time)"
              :key="timelineEvent.id"
              type="button"
              class="mb-2 w-full rounded border border-gray-200 bg-gray-50 p-3 text-left transition hover:border-primary-300 hover:bg-primary-50"
              @click="emit('open', timelineEvent)"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="font-medium leading-tight">{{ timelineEvent.name }}</span>
                <UIcon
                  v-if="timelineEvent.conflicts?.length"
                  name="i-heroicons-exclamation-triangle"
                  class="size-4 shrink-0 text-warning-500"
                />
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <UBadge v-if="timelineEvent.requiredResponsibles" color="neutral" variant="subtle" size="xs">
                  {{ timelineEvent.requiredResponsibles }} resp.
                </UBadge>
                <UBadge
                  v-for="character in timelineEvent.characters || []"
                  :key="`grid-character-${timelineEvent.id}-${character.id}`"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  class="max-w-full truncate"
                >
                  {{ character.name }}
                </UBadge>
                <UBadge
                  v-for="item in timelineEvent.items || []"
                  :key="`grid-item-${timelineEvent.id}-${item.id}`"
                  color="success"
                  variant="subtle"
                  size="xs"
                  class="max-w-full truncate"
                >
                  {{ item.name }}
                </UBadge>
                <UBadge
                  v-for="faction in timelineEvent.factions || []"
                  :key="`grid-faction-${timelineEvent.id}-${faction.id}`"
                  color="warning"
                  variant="subtle"
                  size="xs"
                  class="max-w-full truncate"
                >
                  {{ faction.name }}
                </UBadge>
              </div>
            </button>
          </div>
        </template>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { TimelineEventRow } from '~/utils/timeline'

const props = defineProps<{ events: TimelineEventRow[] }>()
const emit = defineEmits<{ open: [timelineEvent: TimelineEventRow] }>()

const days = computed(() => [...new Set(props.events.map((timelineEvent) => timelineEvent.day))].sort((a, b) => a - b))

const times = computed(() => [...new Set(props.events.map((timelineEvent) => timelineEvent.time))].sort((a, b) => a.localeCompare(b)))

function eventsForSlot(day: number, time: string) {
  return props.events.filter((timelineEvent) => timelineEvent.day === day && timelineEvent.time === time)
}
</script>
