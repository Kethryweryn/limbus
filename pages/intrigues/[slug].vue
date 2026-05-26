<template>
  <div v-if="intrigue" class="p-6 max-w-7xl mx-auto space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UButton to="/intrigues" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
        Intrigues
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

    <IntrigueForm
      v-if="isEditing"
      v-model:intrigue="editableIntrigue"
      :games="games || []"
      :characters="characters || []"
      :factions="factions || []"
      mode="edit"
      @submit="handleFormSubmit"
      @cancel="cancelEdit"
    />

    <template v-else>
      <section class="space-y-3 border-b border-gray-200 pb-6">
        <div class="flex flex-wrap gap-2">
          <UBadge color="neutral" variant="subtle">
            {{ intrigue.game?.title || 'Jeu inconnu' }}
          </UBadge>
          <UBadge color="primary" variant="subtle">
            {{ formatIntrigueLevel(intrigue.level) }}
          </UBadge>
          <UBadge v-if="isUnassigned" color="warning" variant="soft">
            Non associée
          </UBadge>
          <UBadge v-if="!intrigue.published" color="neutral" variant="solid">
            Archivée
          </UBadge>
        </div>

        <h1 class="text-3xl font-bold">{{ intrigue.name }}</h1>
        <p v-if="intrigue.pitch" class="max-w-4xl text-lg leading-8 text-gray-600 whitespace-pre-line">
          {{ intrigue.pitch }}
        </p>
      </section>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <section class="xl:col-span-8 space-y-6">
          <UCard v-if="intrigue.description" variant="outline" class="bg-white">
            <template #header>
              Description
            </template>
            <p class="whitespace-pre-line leading-7 text-gray-700">
              {{ intrigue.description }}
            </p>
          </UCard>

          <UAlert
            v-if="isUnassigned"
            color="warning"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            title="Intrigue non associée"
            description="Cette intrigue n’est liée à aucun personnage, groupe ni objet."
          />
        </section>

        <aside class="xl:col-span-4 space-y-6">
          <UCard variant="outline" class="bg-white">
            <template #header>
              Personnages
            </template>

            <div v-if="intrigue.characters?.length" class="space-y-2">
              <NuxtLink
                v-for="character in intrigue.characters"
                :key="character.id"
                :to="`/characters/${character.slug}`"
                class="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
              >
                <span class="font-medium">{{ character.name }}</span>
                <UIcon name="i-heroicons-chevron-right" class="h-4 w-4 text-gray-400" />
              </NuxtLink>
            </div>
            <p v-else class="text-sm text-gray-500">
              Aucun personnage associé.
            </p>
          </UCard>

          <UCard variant="outline" class="bg-white">
            <template #header>
              Groupes
            </template>

            <div v-if="intrigue.factions?.length" class="space-y-2">
              <NuxtLink
                v-for="faction in intrigue.factions"
                :key="faction.id"
                :to="`/factions/${faction.slug}`"
                class="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
              >
                <span class="font-medium">{{ faction.name }}</span>
                <UIcon name="i-heroicons-chevron-right" class="h-4 w-4 text-gray-400" />
              </NuxtLink>
            </div>
            <p v-else class="text-sm text-gray-500">
              Aucun groupe associé.
            </p>
          </UCard>

          <UCard variant="outline" class="bg-white">
            <template #header>
              Objets
            </template>

            <div v-if="intrigue.items?.length" class="space-y-2">
              <NuxtLink
                v-for="item in intrigue.items"
                :key="item.id"
                :to="`/items/${item.slug || item.id}`"
                class="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
              >
                <span class="font-medium">{{ item.name }}</span>
                <UIcon name="i-heroicons-chevron-right" class="h-4 w-4 text-gray-400" />
              </NuxtLink>
            </div>
            <p v-else class="text-sm text-gray-500">
              Aucun objet associé.
            </p>
          </UCard>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup>
import { formatIntrigueLevel } from '~/utils/intrigueLevels'

const route = useRoute()
const router = useRouter()
const slug = route.params.slug
const { data: intrigue, error, refresh } = await useFetch(`/api/intrigues/slug/${slug}`)
const { data: games } = await useFetch('/api/games')
const { data: characters } = await useFetch('/api/characters')
const { data: factions } = await useFetch('/api/factions')

if (error.value) {
  handleApiAuthError(error.value)
  throw createError({ statusCode: 404, message: 'Intrigue introuvable' })
}

const isEditing = ref(route.query.edit === '1')
const editableIntrigue = ref(intrigue.value ? intrigueFormPayload(intrigue.value) : null)
const isUnassigned = computed(() => !(intrigue.value?.characters?.length || intrigue.value?.factions?.length || intrigue.value?.items?.length))

watch(() => route.query.edit, (value) => {
  isEditing.value = value === '1'
  if (isEditing.value && intrigue.value) {
    editableIntrigue.value = intrigueFormPayload(intrigue.value)
  }
})

function intrigueFormPayload(value) {
  return {
    ...value,
    characterIds: value.characterIds || value.characters?.map((character) => character.id) || [],
    factionIds: value.factionIds || value.factions?.map((faction) => faction.id) || []
  }
}

function startEdit() {
  editableIntrigue.value = intrigueFormPayload(intrigue.value)
  isEditing.value = true
  router.replace({ path: route.path, query: { ...route.query, edit: '1' } })
}

function cancelEdit() {
  isEditing.value = false
  editableIntrigue.value = intrigue.value ? intrigueFormPayload(intrigue.value) : null
  const query = { ...route.query }
  delete query.edit
  router.replace({ path: route.path, query })
}

async function handleFormSubmit() {
  if (!editableIntrigue.value?.id) return

  const updatedIntrigue = await useApiFetch(`/api/intrigues/${editableIntrigue.value.id}`, {
    method: 'PUT',
    body: editableIntrigue.value
  })

  if (updatedIntrigue?.slug && updatedIntrigue.slug !== route.params.slug) {
    intrigue.value = updatedIntrigue
    await router.replace(`/intrigues/${updatedIntrigue.slug}`)
  } else {
    await refresh()
  }

  cancelEdit()
}
</script>
