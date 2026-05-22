<template>
  <div v-if="faction" class="p-6 max-w-7xl mx-auto space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UButton to="/factions" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
        Groupes
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

    <FactionForm
      v-if="isEditing"
      v-model:faction="editableFaction"
      :games="games || []"
      :characters="characters || []"
      mode="edit"
      @submit="handleFormSubmit"
      @cancel="cancelEdit"
    />

    <template v-else>
      <section class="space-y-3 border-b border-gray-200 pb-6">
        <div class="flex flex-wrap gap-2">
          <UBadge color="neutral" variant="subtle">
            {{ faction.game?.title || 'Jeu inconnu' }}
          </UBadge>
          <UBadge color="neutral" variant="outline">
            {{ faction.characters?.length || 0 }} personnage{{ (faction.characters?.length || 0) > 1 ? 's' : '' }}
          </UBadge>
          <UBadge v-if="!faction.published" color="neutral" variant="solid">
            Archivé
          </UBadge>
        </div>
        <h1 class="text-3xl font-bold">{{ faction.name }}</h1>
        <p v-if="faction.pitch" class="max-w-4xl text-lg leading-8 text-gray-600 whitespace-pre-line">
          {{ faction.pitch }}
        </p>
      </section>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <section class="xl:col-span-8 space-y-6">
          <UCard v-if="faction.background || faction.backgroundDocumentUrl" variant="outline" class="bg-white">
            <template #header>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>Background</span>
                <UButton
                  v-if="faction.backgroundDocumentUrl"
                  :to="faction.backgroundDocumentUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  icon="i-heroicons-arrow-top-right-on-square"
                  color="neutral"
                  variant="soft"
                >
                  Ouvrir le document
                </UButton>
              </div>
            </template>
            <p v-if="faction.background" class="whitespace-pre-line leading-7 text-gray-700">
              {{ faction.background }}
            </p>
          </UCard>

          <UCard v-if="faction.costumeIndications" variant="outline" class="bg-white">
            <template #header>
              Indications costumes
            </template>
            <p class="whitespace-pre-line leading-7 text-gray-700">
              {{ faction.costumeIndications }}
            </p>
          </UCard>
        </section>

        <aside class="xl:col-span-4 space-y-6">
          <UCard variant="outline" class="bg-white">
            <template #header>
              Personnages associés
            </template>

            <div v-if="faction.characters?.length" class="space-y-2">
              <NuxtLink
                v-for="character in faction.characters"
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
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()
const slug = route.params.slug
const { data: faction, error, refresh } = await useFetch(`/api/factions/slug/${slug}`)
const { data: games } = await useFetch('/api/games')
const { data: characters } = await useFetch('/api/characters')

if (error.value) {
  handleApiAuthError(error.value)
  throw createError({ statusCode: 404, message: 'Groupe introuvable' })
}

const isEditing = ref(route.query.edit === '1')
const editableFaction = ref(faction.value ? factionFormPayload(faction.value) : null)

watch(() => route.query.edit, (value) => {
  isEditing.value = value === '1'
  if (isEditing.value && faction.value) {
    editableFaction.value = factionFormPayload(faction.value)
  }
})

function factionFormPayload(value) {
  return {
    ...value,
    characterIds: value.characterIds || value.characters?.map((character) => character.id) || []
  }
}

function startEdit() {
  editableFaction.value = factionFormPayload(faction.value)
  isEditing.value = true
  router.replace({ path: route.path, query: { ...route.query, edit: '1' } })
}

function cancelEdit() {
  isEditing.value = false
  editableFaction.value = faction.value ? factionFormPayload(faction.value) : null
  const query = { ...route.query }
  delete query.edit
  router.replace({ path: route.path, query })
}

async function handleFormSubmit() {
  if (!editableFaction.value?.id) return

  const updatedFaction = await useApiFetch(`/api/factions/${editableFaction.value.id}`, {
    method: 'PUT',
    body: editableFaction.value
  })

  if (updatedFaction?.slug && updatedFaction.slug !== route.params.slug) {
    faction.value = updatedFaction
    await router.replace(`/factions/${updatedFaction.slug}`)
  } else {
    await refresh()
  }

  cancelEdit()
}
</script>
