<template>
  <!-- Une session de la liste : état, raccourcis vers ses onglets, avancement du cast (US-116, découpé de pages/sessions/index.vue).
       La carte entière ouvre la session, comme les autres listes (US-209) ; ses boutons arrêtent leur clic -->
  <ContentCard :to="`/sessions/${session.slug}`" class="mb-4">
    <template #header>
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 class="font-semibold">{{ session.name }}</h3>
          <p class="text-sm text-gray-500">
            {{ session.game?.title || 'Jeu inconnu' }}
            <span v-if="session.date"> · {{ formatSessionDate(session.date) }}</span>
            <span v-if="session.location"> · {{ session.location.name }}</span>
          </p>
        </div>
        <div class="flex flex-col items-start md:items-end gap-2">
          <div>
            <UBadge :color="status.color" variant="subtle" size="xs">
              {{ status.label }}
            </UBadge>
            <UBadge v-if="session.published" color="primary" variant="outline" size="xs" class="ml-1">
              Visible sur la page publique
            </UBadge>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton v-for="tab in TABS" :key="tab.key" size="xs" color="neutral" variant="soft" :to="`/sessions/${session.slug}?tab=${tab.key}`" @click.stop>
              {{ tab.label }}
            </UButton>
            <UButton size="xs" color="primary" @click.stop="emit('edit')">Modifier</UButton>
            <UButton size="xs" color="error" @click.stop="emit('delete')">Supprimer</UButton>
          </div>
        </div>
      </div>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div>
        <span class="text-gray-500">Lieu</span>
        <div class="font-medium">
          {{ session.location ? formatLocation(session.location) : 'Non renseigné' }}
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between gap-3 mb-2">
          <span class="text-gray-500">Cast assigné</span>
          <span class="font-medium">
            {{ cast.assigned }}/{{ cast.total }} rôle(s)
            <span class="text-gray-500">({{ cast.percent }}%)</span>
          </span>
        </div>
        <UProgress :model-value="cast.percent" />
      </div>
    </div>

    <div v-if="session.assignments?.length" class="mt-4">
      <h4 class="text-sm font-semibold mb-2">Assignations</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div
          v-for="assignment in session.assignments"
          :key="assignment.id"
          class="text-sm border rounded p-2 bg-gray-50"
        >
          <div class="flex items-start gap-3">
            <button
              type="button"
              class="size-20 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center"
              :class="assignment.photoUrl ? 'cursor-pointer' : 'cursor-default'"
              @click.stop="assignment.photoUrl && emit('preview', assignment.photoUrl)"
            >
              <img
                v-if="assignment.photoUrl"
                :src="assignment.photoUrl"
                alt=""
                class="h-full w-full object-cover"
              >
              <UIcon v-else name="i-heroicons-user" class="size-8 text-gray-400" />
            </button>
            <div class="min-w-0">
              <div class="font-medium">{{ assignment.character?.name }}</div>
              <div class="text-gray-600">
                {{ assignment.participant?.name || 'Participant non assigné' }}
                <span v-if="assignment.participant?.email"> · {{ assignment.participant.email }}</span>
              </div>
            </div>
          </div>
          <div v-if="assignment.notes" class="text-gray-500">{{ assignment.notes }}</div>
        </div>
      </div>
    </div>
  </ContentCard>
</template>

<script setup lang="ts">
import type { ApiResponse } from '~/composables/useApiFetch'
import { castProgress, formatSessionDate, sessionStatusMeta } from '~/utils/sessions'

const props = defineProps<{ session: ApiResponse<'/api/sessions'>[number] }>()
const emit = defineEmits<{ edit: [], delete: [], preview: [photoUrl: string] }>()

const TABS = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'documents', label: 'Documents' },
  { key: 'payments', label: 'Paiements' },
  { key: 'cast', label: 'Cast' }
]

const status = computed(() => sessionStatusMeta(props.session.status))
const cast = computed(() => castProgress(props.session.assignments))

const formatLocation = (location: { name: string, address?: string | null }) =>
  location.address ? `${location.name} - ${location.address}` : location.name
</script>
