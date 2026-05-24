<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Groupes</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer un groupe
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher un groupe..." icon="i-heroicons-magnifying-glass" />
      <USelect
        v-if="!selectedGame"
        v-model="gameFilter"
        :items="gameFilterOptions"
        value-key="value"
        class="w-full md:w-64"
      />
      <USelect
        v-model="sortOption"
        :items="sortOptions"
        value-key="value"
        class="w-full md:w-64"
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <UCard
        v-for="faction in paginatedFactions"
        :key="faction.id"
        class="cursor-pointer transition-shadow hover:shadow-md"
        role="link"
        tabindex="0"
        @click="openFactionPage(faction)"
        @keydown.enter="openFactionPage(faction)"
      >
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-2">
              <h2 class="text-lg font-semibold leading-tight">
                {{ faction.name }}
              </h2>
              <div class="flex flex-wrap gap-1">
                <UBadge color="neutral" variant="subtle" size="xs" class="max-w-full truncate">
                  {{ faction.game?.title || 'Jeu inconnu' }}
                </UBadge>
                <UBadge color="neutral" variant="outline" size="xs">
                  {{ faction.characters?.length || 0 }} personnage{{ (faction.characters?.length || 0) > 1 ? 's' : '' }}
                </UBadge>
                <UBadge v-if="!faction.published" color="neutral" variant="solid" size="xs">
                  Archivé
                </UBadge>
              </div>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm leading-6 text-gray-600 line-clamp-5">
            {{ faction.pitch || 'Aucun pitch renseigné.' }}
          </p>

          <div v-if="faction.characters?.length" class="flex flex-wrap gap-1">
            <UBadge
              v-for="character in faction.characters.slice(0, 4)"
              :key="character.id"
              color="primary"
              variant="subtle"
              size="xs"
              class="max-w-40 truncate"
            >
              {{ character.name }}
            </UBadge>
            <UBadge v-if="faction.characters.length > 4" color="neutral" variant="outline" size="xs">
              +{{ faction.characters.length - 4 }}
            </UBadge>
          </div>

          <div class="flex flex-wrap gap-2 pt-1">
            <UButton icon="i-heroicons-pencil-square" size="xs" color="primary" @click.stop="startEdit(faction)">
              Modifier
            </UButton>
            <UButton icon="i-heroicons-trash" size="xs" color="error" variant="soft" @click.stop="deleteFaction(faction.id)">
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
      :title="formMode === 'edit' ? 'Modifier le groupe' : 'Créer un groupe'"
      :full-page-to="formMode === 'edit' && activeFormFaction?.slug ? `/factions/${activeFormFaction.slug}?edit=1` : null"
      @close="closeFormSlideover"
      @full-page="showFormSlideover = false"
    >
      <FactionForm
        v-if="activeFormFaction"
        v-model:faction="activeFormFaction"
        :games="games"
        :characters="characters"
        :mode="formMode"
        @submit="handleFactionFormSubmit"
        @cancel="closeFormSlideover"
      />
    </AppWideSlideover>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import FactionForm from '@/components/FactionForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

const factions = ref([])
const games = ref([])
const characters = ref([])
const searchQuery = ref('')
const gameFilter = ref('all')
const sortOption = ref('updated-desc')
const isOffline = ref(false)
const showFormSlideover = ref(false)
const activeFormFaction = ref(null)
const formMode = ref('create')
const router = useRouter()
const { game: selectedGame } = useGameFocus()

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const sortOptions = [
  { label: 'Dernière modification', value: 'updated-desc' },
  { label: 'Nom A-Z', value: 'name-asc' },
  { label: 'Nom Z-A', value: 'name-desc' }
]

const filteredFactions = computed(() => {
  const term = searchQuery.value.toLowerCase()
  const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

  const result = factions.value
    .filter((faction) => !gameId || faction.gameId === gameId)
    .filter((faction) =>
      [
        faction.name,
        faction.pitch,
        faction.background,
        faction.costumeIndications,
        faction.game?.title,
        ...(faction.characters || []).map((character) => character.name)
      ].some((field) => field?.toLowerCase().includes(term))
    )

  switch (sortOption.value) {
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

const paginatedFactions = computed(() => {
  const start = (page.value - 1) * itemsPerPage
  return filteredFactions.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredFactions.value.length / itemsPerPage)))

const nextPage = () => {
  if (page.value < totalPages.value) page.value++
}

const prevPage = () => {
  if (page.value > 1) page.value--
}

watch([searchQuery, gameFilter, sortOption, filteredFactions], () => {
  page.value = 1
})

const fetchFactions = async () => {
  if (isOfflineMode()) {
    factions.value = await getFromStore('factions', 'list') || []
    return
  }

  const data = await useApiFetch('/api/factions')
  factions.value = data
  await saveToStore('factions', 'list', data)
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

const refreshData = async () => {
  await Promise.all([fetchFactions(), fetchGames(), fetchCharacters()])
}

const updateStatus = () => {
  const wasOffline = isOffline.value
  isOffline.value = isOfflineMode()

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

function factionFormPayload(faction) {
  return {
    ...faction,
    characterIds: faction.characterIds || faction.characters?.map((character) => character.id) || []
  }
}

function startCreate() {
  activeFormFaction.value = {
    name: '',
    pitch: '',
    background: '',
    backgroundDocumentUrl: '',
    costumeIndications: '',
    gameId: selectedGame.value?.id || games.value[0]?.id || '',
    characterIds: [],
    published: true
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(faction) {
  activeFormFaction.value = factionFormPayload(faction)
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormFaction.value = null
  showFormSlideover.value = false
}

function openFactionPage(faction) {
  if (!faction?.slug) return
  router.push(`/factions/${faction.slug}`)
}

async function handleFactionFormSubmit() {
  if (formMode.value === 'create') {
    await useApiFetch('/api/factions', {
      method: 'POST',
      body: activeFormFaction.value
    })
  } else {
    await useApiFetch(`/api/factions/${activeFormFaction.value.id}`, {
      method: 'PUT',
      body: activeFormFaction.value
    })
  }

  closeFormSlideover()
  await Promise.all([fetchFactions(), fetchCharacters()])
}

async function deleteFaction(id) {
  if (!confirm('Supprimer ce groupe ? Les personnages liés seront conservés.')) return

  await useApiFetch(`/api/factions/${id}`, { method: 'DELETE' })
  await Promise.all([fetchFactions(), fetchCharacters()])
}
</script>
