<template>
  <div v-if="faction" class="p-6 max-w-7xl mx-auto space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UButton to="/factions" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
        Groupes
      </UButton>
      <div v-if="!isEditing" class="flex flex-wrap gap-2">
        <UButton
          icon="i-heroicons-identification"
          color="neutral"
          variant="soft"
          @click="showTrombinoscopeModal = true"
        >
          Trombinoscope
        </UButton>
        <UButton
          icon="i-heroicons-pencil-square"
          color="primary"
          @click="startEdit"
        >
          Modifier
        </UButton>
      </div>
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

          <UCard variant="outline" class="bg-white">
            <template #header>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>Intrigues associées</span>
                <UButton
                  color="neutral"
                  variant="soft"
                  size="sm"
                  :icon="faction.intrigues?.length ? 'i-heroicons-pencil-square' : 'i-heroicons-plus'"
                  @click="showIntrigueModal = true"
                >
                  {{ faction.intrigues?.length ? 'Modifier' : 'Ajouter' }}
                </UButton>
              </div>
            </template>

            <div v-if="faction.intrigues?.length" class="space-y-2">
              <NuxtLink
                v-for="intrigue in faction.intrigues"
                :key="intrigue.id"
                :to="`/intrigues/${intrigue.slug}`"
                class="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
              >
                <span class="font-medium">{{ intrigue.name }}</span>
                <UIcon name="i-heroicons-chevron-right" class="h-4 w-4 text-gray-400" />
              </NuxtLink>
            </div>
            <p v-else class="text-sm text-gray-500">
              Aucune intrigue associée.
            </p>
          </UCard>
        </aside>
      </div>
    </template>

    <UModal v-model:open="showIntrigueModal" title="Intrigues du groupe">
      <template #body>
        <form class="space-y-4" @submit.prevent="saveFactionIntrigues">
          <UFormField label="Intrigues">
            <USelectMenu
              v-model="selectedIntrigueIds"
              :items="intrigueOptions"
              value-key="value"
              multiple
              placeholder="Associer des intrigues"
              class="w-full"
            />
          </UFormField>
          <div class="flex flex-wrap gap-2">
            <UButton type="submit" color="primary">
              Enregistrer
            </UButton>
            <UButton type="button" color="neutral" variant="soft" @click="showIntrigueModal = false">
              Annuler
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <UModal v-model:open="showTrombinoscopeModal" title="Trombinoscope du groupe">
      <template #body>
        <form class="space-y-4" @submit.prevent="saveFactionTrombinoscopeOptions">
          <UCheckbox
            v-model="trombinoscopeOptions.showInTrombinoscope"
            label="Afficher le nom du groupe dans les trombinoscopes"
            description="Désactivé par défaut pour ne pas révéler les appartenances de groupe."
          />
          <div class="flex flex-wrap gap-2">
            <UButton type="submit" color="primary">
              Enregistrer
            </UButton>
            <UButton type="button" color="neutral" variant="soft" @click="showTrombinoscopeModal = false">
              Annuler
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()
const slug = route.params.slug
const { data: faction, error, refresh } = await useFetch(`/api/factions/slug/${slug}`)
const { data: games } = await useFetch('/api/games')
const { data: characters } = await useFetch('/api/characters')
const { data: intrigues, refresh: refreshIntrigues } = await useFetch('/api/intrigues')

if (error.value) {
  handleApiAuthError(error.value)
  throw createError({ statusCode: 404, message: 'Groupe introuvable' })
}

const isEditing = ref(route.query.edit === '1')
const editableFaction = ref(faction.value ? factionFormPayload(faction.value) : null)
const showIntrigueModal = ref(false)
const showTrombinoscopeModal = ref(false)
const trombinoscopeOptions = ref({
  showInTrombinoscope: Boolean(faction.value?.showInTrombinoscope)
})
const selectedIntrigueIds = ref(faction.value?.intrigues?.map((intrigue) => intrigue.id) || [])

const availableIntrigues = computed(() =>
  (intrigues.value || [])
    .filter((intrigue) => intrigue.gameId === faction.value?.gameId)
    .sort((a, b) => a.name.localeCompare(b.name))
)

const intrigueOptions = computed(() =>
  availableIntrigues.value.map((intrigue) => ({
    label: intrigue.name,
    value: intrigue.id
  }))
)

watch(() => route.query.edit, (value) => {
  isEditing.value = value === '1'
  if (isEditing.value && faction.value) {
    editableFaction.value = factionFormPayload(faction.value)
  }
})

watch(() => faction.value?.intrigues, (value) => {
  selectedIntrigueIds.value = value?.map((intrigue) => intrigue.id) || []
})

watch(() => faction.value?.showInTrombinoscope, (value) => {
  trombinoscopeOptions.value.showInTrombinoscope = Boolean(value)
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

async function saveFactionIntrigues() {
  if (!faction.value?.id) return

  const currentIds = new Set(faction.value.intrigues?.map((intrigue) => intrigue.id) || [])
  const nextIds = new Set(selectedIntrigueIds.value || [])
  const relevantIntrigues = availableIntrigues.value.filter((intrigue) =>
    currentIds.has(intrigue.id) || nextIds.has(intrigue.id)
  )

  await Promise.all(relevantIntrigues.map((intrigue) => {
    const factionIds = new Set(intrigue.factions?.map((item) => item.id) || [])

    if (nextIds.has(intrigue.id)) {
      factionIds.add(faction.value.id)
    } else {
      factionIds.delete(faction.value.id)
    }

    return useApiFetch(`/api/intrigues/${intrigue.id}`, {
      method: 'PUT',
      body: {
        name: intrigue.name,
        pitch: intrigue.pitch,
        description: intrigue.description,
        level: intrigue.level,
        gameId: intrigue.gameId,
        characterIds: intrigue.characters?.map((character) => character.id) || [],
        factionIds: Array.from(factionIds),
        published: intrigue.published
      }
    })
  }))

  showIntrigueModal.value = false
  await Promise.all([refresh(), refreshIntrigues()])
}

async function saveFactionTrombinoscopeOptions() {
  if (!faction.value?.id) return

  const updatedFaction = await useApiFetch(`/api/factions/${faction.value.id}`, {
    method: 'PUT',
    body: {
      ...factionFormPayload(faction.value),
      showInTrombinoscope: Boolean(trombinoscopeOptions.value.showInTrombinoscope)
    }
  })

  faction.value = updatedFaction
  showTrombinoscopeModal.value = false
  await refresh()
}
</script>
