<template>
  <UModal v-model:open="isOpen" title="Trombinoscope" fullscreen>
    <template #body>
      <div class="space-y-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-xl font-semibold">Trombinoscope de {{ character?.name }}</h2>
            <p class="text-sm text-gray-500">
              Sélectionnez les personnages visibles et ajustez les noms, notes et visages connus.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="soft" @click="setAllEntries(false)">
              Tout désélectionner
            </UButton>
            <UButton color="neutral" variant="soft" @click="setAllEntries(true)">
              Tout sélectionner
            </UButton>
            <UButton color="primary" :loading="saving" @click="saveConfig">
              Enregistrer
            </UButton>
          </div>
        </div>

        <div v-if="loading" class="rounded border border-gray-200 bg-white p-5 text-sm text-gray-500">
          Chargement du trombinoscope...
        </div>

        <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <article
            v-for="entry in entries"
            :key="entry.targetCharacterId"
            class="rounded-lg border border-gray-200 bg-white p-4"
          >
            <div class="flex flex-col gap-3">
              <div class="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                <div class="min-w-0 space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="font-semibold">{{ entry.character.name }}</h3>
                    <UBadge color="warning" variant="subtle" size="xs">
                      {{ entry.character.type === CHARACTER_TYPES.pnj ? 'PNJ' : 'PJ' }}
                    </UBadge>
                    <UBadge
                      v-for="faction in entry.character.factions || []"
                      :key="faction.id"
                      color="primary"
                      variant="subtle"
                      size="xs"
                    >
                      {{ faction.name }}
                    </UBadge>
                    <UBadge v-if="entry.character.excludeFromTrombinoscope" color="neutral" variant="solid" size="xs">
                      Exclu globalement
                    </UBadge>
                  </div>
                </div>
                <div class="flex flex-wrap gap-4 lg:justify-end">
                  <UCheckbox
                    v-model="entry.included"
                    label="Inclure"
                    :disabled="entry.character.excludeFromTrombinoscope"
                  />
                  <UCheckbox
                    v-model="entry.faceKnown"
                    label="Visage connu"
                    :disabled="!entry.included || entry.character.trombinoscopeFaceHidden"
                  />
                </div>
              </div>

              <UFormField label="Nom affiché">
                <UInput v-model="entry.displayName" :disabled="!entry.included" class="w-full" />
              </UFormField>

              <UFormField label="Note personnalisée">
                <UTextarea v-model="entry.note" :disabled="!entry.included" :rows="3" class="w-full" />
              </UFormField>
            </div>
          </article>
        </div>

        <p v-if="serverError" class="text-sm text-red-500">{{ serverError }}</p>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { CHARACTER_TYPES } from '~/utils/domain'

const props = defineProps({
  open: { type: Boolean, default: false },
  character: { type: Object, required: true }
})

const emit = defineEmits(['update:open'])

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})
const loading = ref(false)
const saving = ref(false)
const entries = ref([])
const serverError = ref('')

watch(() => props.open, async (value) => {
  if (value) {
    await loadConfig()
  }
})

async function loadConfig() {
  if (!props.character?.id) return

  loading.value = true
  serverError.value = ''

  try {
    const data = await useApiFetch(`/api/characters/${props.character.id}/trombinoscope`)
    entries.value = (data.characters || []).map((target) => ({
      targetCharacterId: target.id,
      character: target,
      included: Boolean(target.trombinoscope?.included) && !target.excludeFromTrombinoscope,
      faceKnown: Boolean(target.trombinoscope?.faceKnown) && !target.trombinoscopeFaceHidden,
      displayName: target.trombinoscope?.displayName || target.name,
      note: target.trombinoscope?.note || ''
    }))
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    loading.value = false
  }
}

function setAllEntries(value) {
  entries.value = entries.value.map((entry) => ({
    ...entry,
    included: entry.character.excludeFromTrombinoscope ? false : value
  }))
}

async function saveConfig() {
  if (!props.character?.id) return

  saving.value = true
  serverError.value = ''
  try {
    await useApiFetch(`/api/characters/${props.character.id}/trombinoscope`, {
      method: 'PUT',
      body: {
        entries: entries.value.map((entry) => ({
          targetCharacterId: entry.targetCharacterId,
          included: Boolean(entry.included) && !entry.character.excludeFromTrombinoscope,
          faceKnown: Boolean(entry.faceKnown) && !entry.character.trombinoscopeFaceHidden,
          displayName: entry.displayName,
          note: entry.note
        }))
      }
    })
    isOpen.value = false
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    saving.value = false
  }
}
</script>
