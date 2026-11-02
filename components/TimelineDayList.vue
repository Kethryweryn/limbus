<template>
  <!-- Détail des événements de la timeline (US-115), jour par jour -->
  <div>
    <h2 class="text-lg font-semibold mb-3">Détail des événements</h2>
    <section
      v-for="dayGroup in eventsByDay"
      :key="dayGroup.day"
      class="rounded-lg border border-gray-200 bg-white"
    >
      <div class="border-b border-gray-100 px-4 py-3">
        <h2 class="font-semibold">Jour {{ dayGroup.day }}</h2>
      </div>

      <div class="divide-y divide-gray-100">
        <article
          v-for="timelineEvent in dayGroup.events"
          :key="timelineEvent.id"
          class="grid cursor-pointer grid-cols-1 lg:grid-cols-[7rem_1fr_auto] gap-4 p-4 hover:bg-gray-50"
          role="link"
          tabindex="0"
          @click="emit('open', timelineEvent)"
          @keydown.enter="emit('open', timelineEvent)"
        >
          <div class="flex lg:block items-center gap-2">
            <UBadge color="neutral" variant="subtle">{{ timelineEvent.time }}</UBadge>
            <UBadge
              v-if="timelineEvent.conflicts?.length"
              color="warning"
              variant="soft"
              size="xs"
            >
              Conflit
            </UBadge>
          </div>

          <div class="min-w-0 space-y-3">
            <div>
              <h3 class="text-lg font-semibold leading-tight">{{ timelineEvent.name }}</h3>
              <p class="text-sm text-gray-500">{{ timelineEvent.game?.title || 'Jeu inconnu' }}</p>
            </div>

            <p class="text-sm leading-6 text-gray-600 line-clamp-3">
              {{ timelineEvent.description || 'Aucune description renseignée.' }}
            </p>

            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="character in timelineEvent.characters || []"
                :key="`character-${character.id}`"
                color="neutral"
                variant="subtle"
                size="xs"
                class="max-w-44 truncate"
              >
                {{ character.name }}
              </UBadge>
              <UBadge
                v-for="intrigue in timelineEvent.intrigues || []"
                :key="`intrigue-${intrigue.id}`"
                color="primary"
                variant="subtle"
                size="xs"
                class="max-w-44 truncate"
              >
                {{ intrigue.name }}
              </UBadge>
              <UBadge
                v-for="faction in timelineEvent.factions || []"
                :key="`faction-${faction.id}`"
                color="warning"
                variant="subtle"
                size="xs"
                class="max-w-44 truncate"
              >
                {{ faction.name }}
              </UBadge>
              <UBadge
                v-for="item in timelineEvent.items || []"
                :key="`item-${item.id}`"
                color="success"
                variant="subtle"
                size="xs"
                class="max-w-44 truncate"
              >
                {{ item.name }}
              </UBadge>
            </div>

            <UAlert
              v-if="timelineEvent.conflicts?.length"
              color="warning"
              variant="soft"
              icon="i-heroicons-exclamation-triangle"
              :title="conflictTitle(timelineEvent)"
            />
          </div>

          <div class="flex lg:flex-col gap-2 lg:items-end">
            <UBadge color="neutral" variant="outline" class="whitespace-nowrap">
              {{ timelineEvent.requiredResponsibles || 0 }} responsable(s)
            </UBadge>
            <UButton
              icon="i-heroicons-pencil-square"
              size="xs"
              color="primary"
              @click.stop="emit('edit', timelineEvent)"
            >
              Modifier
            </UButton>
            <UButton
              icon="i-heroicons-trash"
              size="xs"
              color="error"
              variant="soft"
              @click.stop="emit('remove', timelineEvent.id)"
            >
              Supprimer
            </UButton>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { conflictTitle, type TimelineEventRow } from '~/utils/timeline'

const props = defineProps<{ events: TimelineEventRow[] }>()
const emit = defineEmits<{ open: [timelineEvent: TimelineEventRow], edit: [timelineEvent: TimelineEventRow], remove: [id: string] }>()

const eventsByDay = computed(() => {
  const groups = new Map<number, TimelineEventRow[]>()
  for (const timelineEvent of props.events) {
    const current = groups.get(timelineEvent.day) || []
    current.push(timelineEvent)
    groups.set(timelineEvent.day, current)
  }

  return [...groups.entries()].map(([day, events]) => ({ day, events }))
})
</script>
