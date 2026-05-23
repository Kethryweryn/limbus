<template>
  <div v-if="item" class="p-6 max-w-7xl mx-auto space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UButton to="/items" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
        Objets
      </UButton>
      <UButton
        v-if="!isEditing"
        icon="i-heroicons-pencil-square"
        color="primary"
        @click="startEdit"
      >
        Modifier
      </UButton>
    </div>

    <ItemForm
      v-if="isEditing"
      v-model:item="editableItem"
      :games="games || []"
      :characters="characters || []"
      :intrigues="intrigues || []"
      mode="edit"
      @submit="saveItem"
      @cancel="cancelEdit"
    />

    <template v-else>
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-3xl font-bold">{{ item.name }}</h1>
          <UBadge v-if="isUnassigned" color="warning" variant="soft">
            Non associé
          </UBadge>
        </div>
        <p class="text-sm text-gray-500">{{ item.game?.title || 'Jeu inconnu' }}</p>
      </div>

      <section v-if="item.description" class="space-y-2 rounded-lg border border-gray-200 bg-white p-5">
        <h2 class="text-xl font-semibold">Description</h2>
        <p class="whitespace-pre-line leading-7 text-gray-700">{{ item.description }}</p>
      </section>

      <section class="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 class="text-xl font-semibold">Localisation</h2>
        <p>{{ formatItemLocation(item) }}</p>
      </section>

      <section class="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 class="text-xl font-semibold">Associations</h2>
        <div v-if="item.characters?.length || item.intrigues?.length" class="space-y-4">
          <div v-if="item.characters?.length">
            <h3 class="text-sm font-semibold mb-2">Personnages</h3>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="character in item.characters"
                :key="character.id"
                :to="`/characters/${character.slug}`"
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-heroicons-identification"
              >
                {{ character.name }}
              </UButton>
            </div>
          </div>

          <div v-if="item.intrigues?.length">
            <h3 class="text-sm font-semibold mb-2">Intrigues</h3>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="intrigue in item.intrigues"
                :key="intrigue.id"
                :to="`/intrigues/${intrigue.slug}`"
                color="primary"
                variant="soft"
                size="sm"
                icon="i-heroicons-book-open"
              >
                {{ intrigue.name }}
              </UButton>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500">Cet objet n’est associé à aucun personnage ni aucune intrigue.</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import ItemForm from '@/components/ItemForm.vue'

const route = useRoute()
const router = useRouter()
const { data: item, error, refresh } = await useFetch(`/api/items/${route.params.id}`)
const { data: games } = await useFetch('/api/games')
const { data: characters } = await useFetch('/api/characters')
const { data: intrigues } = await useFetch('/api/intrigues')

if (error.value) {
  handleApiAuthError(error.value)
  throw createError({ statusCode: error.value.statusCode || 404, message: 'Objet introuvable' })
}

const isEditing = ref(route.query.edit === '1')
const editableItem = ref(item.value ? itemFormPayload(item.value) : null)
const isUnassigned = computed(() => !(item.value?.characters?.length || item.value?.intrigues?.length))

watch(() => route.query.edit, (value) => {
  isEditing.value = value === '1'
  if (isEditing.value && item.value) {
    editableItem.value = itemFormPayload(item.value)
  }
})

function itemFormPayload(value) {
  return {
    ...value,
    characterIds: value.characters?.map((character) => character.id) || [],
    intrigueIds: value.intrigues?.map((intrigue) => intrigue.id) || [],
    locationCharacterId: value.locationCharacterId || value.locationCharacter?.id || '',
    locationText: value.locationText || ''
  }
}

function formatItemLocation(value) {
  if (value.locationCharacter) return value.locationCharacter.name
  if (value.locationText) return value.locationText
  return 'Non renseignée'
}

function startEdit() {
  editableItem.value = itemFormPayload(item.value)
  isEditing.value = true
  router.replace({ path: route.path, query: { ...route.query, edit: '1' } })
}

function cancelEdit() {
  isEditing.value = false
  editableItem.value = item.value ? itemFormPayload(item.value) : null
  const query = { ...route.query }
  delete query.edit
  router.replace({ path: route.path, query })
}

async function saveItem() {
  if (!editableItem.value?.id) return

  item.value = await useApiFetch(`/api/items/${editableItem.value.id}`, {
    method: 'PUT',
    body: editableItem.value
  })
  await refresh()
  cancelEdit()
}
</script>
