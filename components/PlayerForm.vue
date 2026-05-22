<template>
  <UCard>
    <template #header>
      {{ mode === 'edit' ? 'Modifier le joueur' : 'Créer un joueur' }}
    </template>

    <form @submit.prevent="submit" class="space-y-4">
      <UFormField label="Jeux">
        <USelectMenu
          v-model="localPlayer.gameIds"
          :items="gameOptions"
          value-key="value"
          multiple
          placeholder="Choisissez les jeux"
        />
      </UFormField>

      <UFormField label="Nom" :error="errors.name">
        <UInput v-model="localPlayer.name" required />
      </UFormField>

      <UFormField label="Email">
        <UInput v-model="localPlayer.email" type="email" />
      </UFormField>

      <UFormField label="Téléphone">
        <UInput v-model="localPlayer.phone" />
      </UFormField>

      <UFormField label="Notes">
        <UTextarea v-model="localPlayer.notes" />
      </UFormField>

      <div class="flex gap-2">
        <UButton type="submit" color="primary">
          {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
        </UButton>
        <UButton type="button" color="neutral" @click="$emit('cancel')">
          Annuler
        </UButton>
      </div>

      <p v-if="serverError" class="text-red-500 text-sm mt-2">{{ serverError }}</p>
    </form>
  </UCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  player: { type: Object, required: true },
  games: { type: Array, required: true },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:player'])

const localPlayer = ref({ ...props.player })
const errors = ref({})
const serverError = ref('')

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

watch(() => props.player, (newPlayer) => {
  localPlayer.value = { ...newPlayer }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

function validate() {
  errors.value = {}
  if (!localPlayer.value.name?.trim()) {
    errors.value.name = 'Le nom est requis.'
  }
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return

  try {
    emit('update:player', localPlayer.value)
    await emit('submit')
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}
</script>
