<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Intrigues</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton v-if="!isOffline" icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer une intrigue
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher une intrigue..." icon="i-heroicons-magnifying-glass" />
      <USelect
        v-if="!selectedGame"
        v-model="gameFilter"
        :items="gameFilterOptions"
        value-key="value"
        class="w-full md:w-64"
      />
      <USelect v-model="levelFilter" :items="levelFilterOptions" value-key="value" class="w-full md:w-72" />
      <USelect v-model="sortOption" :items="sortOptions" value-key="value" class="w-full md:w-64" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <UCard
        v-for="intrigue in paginatedIntrigues"
        :key="intrigue.id"
        class="cursor-pointer transition-shadow hover:shadow-md"
        role="link"
        tabindex="0"
        @click="openIntriguePage(intrigue)"
        @keydown.enter="openIntriguePage(intrigue)"
      >
        <template #header>
          <div class="space-y-2">
            <div class="flex items-start justify-between gap-3">
              <h2 class="text-lg font-semibold leading-tight">
                {{ intrigue.name }}
              </h2>
              <UBadge v-if="isUnassigned(intrigue)" color="warning" variant="soft" size="xs">
                Non associée
              </UBadge>
            </div>
            <div class="flex flex-wrap gap-1">
              <UBadge color="neutral" variant="subtle" size="xs" class="max-w-full truncate">
                {{ intrigue.game?.title || 'Jeu inconnu' }}
              </UBadge>
              <UBadge color="primary" variant="subtle" size="xs">
                {{ formatIntrigueLevel(intrigue.level) }}
              </UBadge>
              <UBadge v-if="!intrigue.published" color="neutral" variant="solid" size="xs">
                Archivée
              </UBadge>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm leading-6 text-gray-600 line-clamp-5">
            {{ intrigue.pitch || 'Aucun pitch renseigné.' }}
          </p>

          <div v-if="intrigue.characters?.length || intrigue.factions?.length || intrigue.items?.length" class="flex flex-wrap gap-1">
            <UBadge
              v-for="character in intrigue.characters || []"
              :key="`character-${character.id}`"
              color="neutral"
              variant="subtle"
              size="xs"
              class="max-w-40 truncate"
            >
              {{ character.name }}
            </UBadge>
            <UBadge
              v-for="faction in intrigue.factions || []"
              :key="`faction-${faction.id}`"
              color="primary"
              variant="subtle"
              size="xs"
              class="max-w-40 truncate"
            >
              {{ faction.name }}
            </UBadge>
            <UBadge
              v-for="item in intrigue.items || []"
              :key="`item-${item.id}`"
              color="warning"
              variant="subtle"
              size="xs"
              class="max-w-40 truncate"
            >
              {{ item.name }}
            </UBadge>
          </div>

          <div v-if="!isOffline" class="flex flex-wrap gap-2 pt-1">
            <UButton icon="i-heroicons-pencil-square" size="xs" color="primary" @click.stop="startEdit(intrigue)">
              Modifier
            </UButton>
            <UButton icon="i-heroicons-trash" size="xs" color="error" variant="soft" @click.stop="deleteIntrigue(intrigue.id)">
              Supprimer
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <div class="flex items-center justify-center gap-4 mt-6">
      <UButton @click="prevPage" :disabled="page === 1">← Précédent</UButton>
      <span class="inline-flex items-center text-sm text-gray-500">Page {{ page }} / {{ totalPages }}</span>
      <UButton @click="nextPage" :disabled="page === totalPages">Suivant →</UButton>
    </div>

    <AppWideSlideover
      v-model:open="showFormSlideover"
      :title="formMode === 'edit' ? 'Modifier l’intrigue' : 'Créer une intrigue'"
      :full-page-to="formMode === 'edit' && activeFormIntrigue?.slug ? `/intrigues/${activeFormIntrigue.slug}?edit=1` : null"
      @close="closeFormSlideover"
      @full-page="showFormSlideover = false"
    >
      <IntrigueForm
        v-if="activeFormIntrigue"
        v-model:intrigue="activeFormIntrigue"
        :games="games"
        :characters="characters"
        :factions="factions"
        :mode="formMode"
        @submit="handleIntrigueFormSubmit"
        @cancel="closeFormSlideover"
      />
    </AppWideSlideover>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import IntrigueForm from '@/components/IntrigueForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import { formatIntrigueLevel, intrigueLevelOrder } from '~/utils/intrigueLevels'
import { INTRIGUE_LEVEL_OPTIONS, INTRIGUE_LEVELS } from '~/utils/domain'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

const intrigues = ref([])
const games = ref([])
const characters = ref([])
const factions = ref([])
const searchQuery = ref('')
const gameFilter = ref('all')
const levelFilter = ref('all')
const sortOption = ref('updated-desc')
const isOffline = ref(false)
const showFormSlideover = ref(false)
const activeFormIntrigue = ref(null)
const formMode = ref('create')
const router = useRouter()
const { game: selectedGame } = useGameFocus()

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const levelFilterOptions = [
  { label: 'Tous les niveaux', value: 'all' },
  ...INTRIGUE_LEVEL_OPTIONS
]

const sortOptions = [
  { label: 'Dernière modification', value: 'updated-desc' },
  { label: 'Niveau', value: 'level-asc' },
  { label: 'Nom A-Z', value: 'name-asc' },
  { label: 'Nom Z-A', value: 'name-desc' }
]

const filteredIntrigues = computed(() => {
  const term = searchQuery.value.toLowerCase()
  const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

  const result = intrigues.value
    .filter((intrigue) => !gameId || intrigue.gameId === gameId)
    .filter((intrigue) => levelFilter.value === 'all' || intrigue.level === levelFilter.value)
    .filter((intrigue) =>
      [
        intrigue.name,
        intrigue.pitch,
        intrigue.description,
        intrigue.game?.title,
        ...(intrigue.characters || []).map((character) => character.name),
        ...(intrigue.factions || []).map((faction) => faction.name),
        ...(intrigue.items || []).map((item) => item.name)
      ].some((field) => field?.toLowerCase().includes(term))
    )

  switch (sortOption.value) {
    case 'level-asc':
      result.sort((a, b) => (intrigueLevelOrder[a.level] ?? 99) - (intrigueLevelOrder[b.level] ?? 99) || a.name.localeCompare(b.name))
      break
    case 'name-asc':
      result.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'name-desc':
      result.sort((a, b) => b.name.localeCompare(a.name))
      break
    default:
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  return result
})

const page = ref(1)
const itemsPerPage = 9

const paginatedIntrigues = computed(() => {
  const start = (page.value - 1) * itemsPerPage
  return filteredIntrigues.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredIntrigues.value.length / itemsPerPage)))

const nextPage = () => {
  if (page.value < totalPages.value) page.value++
}

const prevPage = () => {
  if (page.value > 1) page.value--
}

watch([searchQuery, gameFilter, levelFilter, sortOption, filteredIntrigues], () => {
  page.value = 1
})

const isUnassigned = (intrigue) => !(intrigue.characters?.length || intrigue.factions?.length || intrigue.items?.length)

const fetchIntrigues = async () => {
  if (isOfflineMode()) {
    intrigues.value = await getFromStore('intrigues', 'list') || []
    return
  }

  const data = await useApiFetch('/api/intrigues')
  intrigues.value = data
  await saveToStore('intrigues', 'list', data)
}

const fetchGames = async () => {
  if (isOfflineMode()) {
    games.value = await getFromStore('games', 'list') || []
    return
  }

  const data = await useApiFetch('/api/games')
  games.value = data
  await saveToStore('games', 'list', data)
}

const fetchCharacters = async () => {
  if (isOfflineMode()) {
    characters.value = await getFromStore('characters', 'list') || []
    return
  }

  const data = await useApiFetch('/api/characters')
  characters.value = data
  await saveToStore('characters', 'list', data)
}

const fetchFactions = async () => {
  if (isOfflineMode()) {
    factions.value = await getFromStore('factions', 'list') || []
    return
  }

  const data = await useApiFetch('/api/factions')
  factions.value = data
  await saveToStore('factions', 'list', data)
}

const refreshData = async () => {
  await Promise.all([fetchIntrigues(), fetchGames(), fetchCharacters(), fetchFactions()])
}

const updateStatus = () => {
  const wasOffline = isOffline.value
  isOffline.value = isOfflineMode()

  if (isOffline.value) {
    closeFormSlideover()
  }

  if (wasOffline !== isOffline.value) {
    refreshData()
  }
}

onMounted(async () => {
  updateStatus()
  window.addEventListener('online', updateStatus)
  window.addEventListener('offline', updateStatus)
  window.addEventListener('limbus:connection-change', updateStatus)
  await refreshData()
})

onUnmounted(() => {
  window.removeEventListener('online', updateStatus)
  window.removeEventListener('offline', updateStatus)
  window.removeEventListener('limbus:connection-change', updateStatus)
})

function intrigueFormPayload(intrigue) {
  return {
    ...intrigue,
    characterIds: intrigue.characterIds || intrigue.characters?.map((character) => character.id) || [],
    factionIds: intrigue.factionIds || intrigue.factions?.map((faction) => faction.id) || []
  }
}

function startCreate() {
  if (isOffline.value) return

  activeFormIntrigue.value = {
    name: '',
    pitch: '',
    description: '',
    level: INTRIGUE_LEVELS.minor,
    gameId: selectedGame.value?.id || games.value[0]?.id || '',
    characterIds: [],
    factionIds: [],
    published: true
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(intrigue) {
  if (isOffline.value) return

  activeFormIntrigue.value = intrigueFormPayload(intrigue)
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormIntrigue.value = null
  showFormSlideover.value = false
}

function openIntriguePage(intrigue) {
  if (!intrigue?.slug) return
  router.push(`/intrigues/${intrigue.slug}`)
}

async function handleIntrigueFormSubmit() {
  if (isOffline.value) return

  if (formMode.value === 'create') {
    await useApiFetch('/api/intrigues', {
      method: 'POST',
      body: activeFormIntrigue.value
    })
  } else {
    await useApiFetch(`/api/intrigues/${activeFormIntrigue.value.id}`, {
      method: 'PUT',
      body: activeFormIntrigue.value
    })
  }

  closeFormSlideover()
  await fetchIntrigues()
}

async function deleteIntrigue(id) {
  if (isOffline.value) return
  if (!confirm('Supprimer cette intrigue ?')) return

  await useApiFetch(`/api/intrigues/${id}`, { method: 'DELETE' })
  await fetchIntrigues()
}
</script>
