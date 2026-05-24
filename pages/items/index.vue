<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Objets</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer un objet
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher un objet..." icon="i-heroicons-magnifying-glass" />
      <USelect
        v-if="!selectedGame"
        v-model="gameFilter"
        :items="gameFilterOptions"
        value-key="value"
        class="w-full md:w-64"
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <UCard
        v-for="item in paginatedItems"
        :key="item.id"
        class="cursor-pointer transition-shadow hover:shadow-md"
        role="link"
        tabindex="0"
        @click="openItemPage(item)"
        @keydown.enter="openItemPage(item)"
      >
        <template #header>
          <div class="space-y-2">
            <div class="flex items-start justify-between gap-3">
              <h2 class="text-lg font-semibold leading-tight">{{ item.name }}</h2>
              <UBadge v-if="isUnassigned(item)" color="warning" variant="soft" size="xs">
                Non associé
              </UBadge>
            </div>
            <div class="flex flex-wrap gap-1">
              <UBadge color="neutral" variant="subtle" size="xs" class="max-w-full truncate">
                {{ item.game?.title || 'Jeu inconnu' }}
              </UBadge>
              <UBadge v-if="!item.published" color="neutral" variant="solid" size="xs">
                Archivé
              </UBadge>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm leading-6 text-gray-600 line-clamp-4">
            {{ item.description || 'Aucune description renseignée.' }}
          </p>

          <div class="text-sm">
            <span class="text-gray-500">Localisation</span>
            <div class="font-medium">{{ formatItemLocation(item) }}</div>
          </div>

          <div v-if="item.characters?.length || item.intrigues?.length" class="flex flex-wrap gap-1">
            <UBadge
              v-for="character in item.characters || []"
              :key="`character-${character.id}`"
              color="neutral"
              variant="subtle"
              size="xs"
              class="max-w-40 truncate"
            >
              {{ character.name }}
            </UBadge>
            <UBadge
              v-for="intrigue in item.intrigues || []"
              :key="`intrigue-${intrigue.id}`"
              color="primary"
              variant="subtle"
              size="xs"
              class="max-w-40 truncate"
            >
              {{ intrigue.name }}
            </UBadge>
          </div>

          <div class="flex flex-wrap gap-2 pt-1">
            <UButton icon="i-heroicons-pencil-square" size="xs" color="primary" @click.stop="startEdit(item)">
              Modifier
            </UButton>
            <UButton icon="i-heroicons-trash" size="xs" color="error" variant="soft" @click.stop="deleteItem(item.id)">
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
      :title="formMode === 'edit' ? 'Modifier l’objet' : 'Créer un objet'"
      :full-page-to="formMode === 'edit' && activeFormItem?.id ? `/items/${activeFormItem.id}?edit=1` : null"
      @close="closeFormSlideover"
      @full-page="showFormSlideover = false"
    >
      <ItemForm
        v-if="activeFormItem"
        v-model:item="activeFormItem"
        :games="games"
        :characters="characters"
        :intrigues="intrigues"
        :mode="formMode"
        @submit="handleItemFormSubmit"
        @cancel="closeFormSlideover"
      />
    </AppWideSlideover>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import ItemForm from '@/components/ItemForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

const items = ref([])
const games = ref([])
const characters = ref([])
const intrigues = ref([])
const searchQuery = ref('')
const gameFilter = ref('all')
const isOffline = ref(false)
const showFormSlideover = ref(false)
const activeFormItem = ref(null)
const formMode = ref('create')
const router = useRouter()
const { game: selectedGame } = useGameFocus()

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const filteredItems = computed(() => {
  const term = searchQuery.value.toLowerCase()
  const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

  return items.value
    .filter((item) => !gameId || item.gameId === gameId)
    .filter((item) =>
      [
        item.name,
        item.description,
        item.locationText,
        item.locationCharacter?.name,
        item.game?.title,
        ...(item.characters || []).map((character) => character.name),
        ...(item.intrigues || []).map((intrigue) => intrigue.name)
      ].some((field) => field?.toLowerCase().includes(term))
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
})

const page = ref(1)
const itemsPerPage = 9

const paginatedItems = computed(() => {
  const start = (page.value - 1) * itemsPerPage
  return filteredItems.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / itemsPerPage)))

const nextPage = () => {
  if (page.value < totalPages.value) page.value++
}

const prevPage = () => {
  if (page.value > 1) page.value--
}

watch([searchQuery, gameFilter, filteredItems], () => {
  page.value = 1
})

const isUnassigned = (item) => !(item.characters?.length || item.intrigues?.length)

const formatItemLocation = (item) => {
  if (item.locationCharacter) return item.locationCharacter.name
  if (item.locationText) return item.locationText
  return 'Non renseignée'
}

const fetchItems = async () => {
  if (isOfflineMode()) {
    items.value = await getFromStore('items', 'list') || []
    return
  }

  const data = await useApiFetch('/api/items')
  items.value = data
  await saveToStore('items', 'list', data)
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

const fetchIntrigues = async () => {
  if (isOfflineMode()) {
    intrigues.value = await getFromStore('intrigues', 'list') || []
    return
  }

  const data = await useApiFetch('/api/intrigues')
  intrigues.value = data
  await saveToStore('intrigues', 'list', data)
}

const refreshData = async () => {
  await Promise.all([fetchItems(), fetchGames(), fetchCharacters(), fetchIntrigues()])
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

function itemFormPayload(item) {
  return {
    ...item,
    characterIds: item.characterIds || item.characters?.map((character) => character.id) || [],
    intrigueIds: item.intrigueIds || item.intrigues?.map((intrigue) => intrigue.id) || [],
    locationCharacterId: item.locationCharacterId || item.locationCharacter?.id || '',
    locationText: item.locationText || ''
  }
}

function startCreate() {
  activeFormItem.value = {
    name: '',
    description: '',
    locationText: '',
    locationCharacterId: '',
    gameId: selectedGame.value?.id || games.value[0]?.id || '',
    characterIds: [],
    intrigueIds: [],
    published: true
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(item) {
  activeFormItem.value = itemFormPayload(item)
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormItem.value = null
  showFormSlideover.value = false
}

function openItemPage(item) {
  if (!item?.id) return
  router.push(`/items/${item.id}`)
}

async function handleItemFormSubmit() {
  if (formMode.value === 'create') {
    await useApiFetch('/api/items', {
      method: 'POST',
      body: activeFormItem.value
    })
  } else {
    await useApiFetch(`/api/items/${activeFormItem.value.id}`, {
      method: 'PUT',
      body: activeFormItem.value
    })
  }

  closeFormSlideover()
  await fetchItems()
}

async function deleteItem(id) {
  if (!confirm('Supprimer cet objet ?')) return

  await useApiFetch(`/api/items/${id}`, { method: 'DELETE' })
  await fetchItems()
}
</script>
