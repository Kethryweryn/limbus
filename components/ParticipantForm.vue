<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier le participant' : 'Créer un participant' }}
    </template>

    <form class="w-full space-y-6" @submit.prevent="submit">
      <UFormField label="Jeux" :error="errors.gameIds">
        <USelectMenu
          v-model="localParticipant.gameIds"
          :items="gameOptions"
          value-key="value"
          multiple
          placeholder="Choisissez les jeux"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <!-- Fiche rattachée à un compte (US-075) : nom et téléphone sont tenus par la personne -->
      <UAlert
        v-if="heldByPerson"
        color="info"
        variant="soft"
        description="Cette personne a un compte Limbus : elle tient elle-même son nom, son téléphone et ses allergies."
      />

      <UFormField label="Nom" :error="errors.name" :help="heldByPerson ? 'Tenu par la personne depuis son compte.' : undefined">
        <UInput v-model="localParticipant.name" required size="lg" class="w-full" :disabled="heldByPerson" />
      </UFormField>

      <UFormField label="Email" :help="heldByPerson ? 'Changer l’email détache la fiche de son compte : à faire seulement pour corriger une erreur.' : undefined">
        <UInput v-model="localParticipant.email" type="email" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Téléphone" :help="heldByPerson ? 'Tenu par la personne depuis son compte.' : undefined">
        <UInput v-model="localParticipant.phone" size="lg" class="w-full" :disabled="heldByPerson" />
      </UFormField>

      <!-- Une note par jeu (US-069) : chaque équipe ne voit que celles de ses jeux -->
      <UFormField
        v-for="game in selectedGames"
        :key="game.value"
        :label="`Notes — ${game.label}`"
        help="Visibles par l’équipe de ce jeu seulement."
      >
        <UTextarea v-model="localParticipant.gameNotes[game.value]" :rows="5" size="lg" class="w-full" />
      </UFormField>

      <div class="flex flex-wrap gap-2 pt-2">
        <UButton type="submit" color="primary" size="lg">
          {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
        </UButton>
        <UButton type="button" color="neutral" size="lg" @click="$emit('cancel')">
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
  participant: { type: Object, required: true },
  games: { type: Array, required: true },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:participant'])

const localParticipant = ref({ ...props.participant })
const errors = ref({})
const serverError = ref('')

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

const heldByPerson = computed(() => Boolean(props.participant.userId))
const selectedGames = computed(() => gameOptions.value.filter((game) => localParticipant.value.gameIds?.includes(game.value)))

watch(() => props.participant, (newParticipant) => {
  // Copie des notes : la fiche affichée ne change qu'à l'enregistrement
  localParticipant.value = { ...newParticipant, gameNotes: { ...(newParticipant.gameNotes || {}) } }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

function validate() {
  errors.value = {}
  if (!localParticipant.value.name?.trim()) {
    errors.value.name = 'Le nom est requis.'
  }
  // Une fiche a toujours au moins un jeu (US-036)
  if (props.mode !== 'edit' && !localParticipant.value.gameIds?.length) {
    errors.value.gameIds = 'Choisissez au moins un jeu.'
  }
  return Object.keys(errors.value).length === 0
}

// Retirer un jeu retire la personne de ses sessions (US-035) ; retirer le dernier supprime la fiche (US-036)
function confirmGameRemoval() {
  if (props.mode !== 'edit') return true
  const next = new Set(localParticipant.value.gameIds || [])
  const removed = (props.participant.gameIds || []).filter((gameId) => !next.has(gameId))
  if (!removed.length) return true
  if (!next.size) {
    return confirm('Retirer le dernier jeu supprime définitivement la fiche et ses données (coordonnées, photos, paiements, envois), sauf si elle est liée au jeu d’une autre équipe. Continuer ?')
  }
  return confirm(`Retirer ${removed.length} jeu(x) retire aussi la personne de leurs sessions (équipe, casting, présence), et ses inscriptions à ces jeux passent à « retirée ». Ses paiements restent, à traiter à part. Continuer ?`)
}

async function submit() {
  if (!validate()) return
  if (!confirmGameRemoval()) return

  try {
    emit('update:participant', localParticipant.value)
    await emit('submit')
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}
</script>


