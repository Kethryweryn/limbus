<template>
  <UModal v-model:open="open" :title="`Reporter - ${session?.name || 'Session'}`">
    <template #body>
      <form class="space-y-4" @submit.prevent="postpone">
        <p class="text-sm text-gray-600">
          Une nouvelle session est créée avec la même équipe et le même casting (notes et photos comprises).
          Celle-ci passe « Reportée » et garde ses paiements, pour les rembourser ou les reporter.
        </p>

        <UFormField label="Nom de la nouvelle session" required>
          <UInput v-model="form.name" required class="w-full" />
        </UFormField>

        <UFormField label="Nouvelle date">
          <UInput v-model="form.date" type="datetime-local" class="w-full" />
        </UFormField>

        <UFormField label="Lieu">
          <USelect v-model="form.locationId" :items="locationOptions" value-key="value" class="w-full" />
        </UFormField>

        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Annuler</UButton>
          <UButton type="submit" color="primary" :loading="saving" :disabled="saving || !form.name.trim()">
            Reporter
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup>
const props = defineProps({
  session: { type: Object, default: null },
  locations: { type: Array, default: () => [] }
})
const emit = defineEmits(['postponed'])
const open = defineModel('open', { type: Boolean, default: false })

const form = ref({ name: '', date: '', locationId: '' })
const saving = ref(false)
const error = ref('')

// Pré-rempli depuis la session reportée, à chaque ouverture
watch(open, (value) => {
  if (!value || !props.session) return
  form.value = { name: `${props.session.name} (report)`, date: '', locationId: props.session.locationId || '' }
  error.value = ''
})

const locationOptions = computed(() => [
  { label: 'Aucun lieu', value: '' },
  ...props.locations
    .filter((location) => location.gameId === props.session?.gameId)
    .map((location) => ({
      label: location.address ? `${location.name} - ${location.address}` : location.name,
      value: location.id
    }))
])

async function postpone() {
  if (!props.session) return
  saving.value = true
  error.value = ''
  try {
    const created = await useApiFetch(`/api/sessions/${props.session.id}/postpone`, {
      method: 'POST',
      body: {
        name: form.value.name,
        date: form.value.date ? new Date(form.value.date).toISOString() : '',
        locationId: form.value.locationId
      }
    })
    open.value = false
    emit('postponed', created)
  } catch (err) {
    error.value = err?.data?.message || err?.message || 'Impossible de reporter la session'
  } finally {
    saving.value = false
  }
}
</script>
