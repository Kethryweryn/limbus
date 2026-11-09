<template>
  <!-- Supprimer un jeu archivé (US-207, SPEC-003 R4 et R17) : on retape son titre, car tout part avec lui -->
  <UModal v-model:open="open" title="Supprimer définitivement ce jeu">
    <template #body>
      <form class="space-y-4" @submit.prevent="remove">
        <p class="text-sm text-gray-700">
          Tout ce qui appartient à « {{ game.title }} » sera supprimé, sans retour possible : son contenu, ses sessions, ses
          inscriptions, ses partages, ses invitations et ses fichiers. Les fiches des participants restent.
        </p>
        <UFormField label="Titre du jeu" :error="mismatch ? 'Le titre ne correspond pas.' : undefined">
          <UInput v-model="typed" class="w-full" autocomplete="off" />
        </UFormField>
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        <div class="flex flex-wrap gap-2">
          <UButton type="submit" color="error" :loading="deleting">Supprimer définitivement</UButton>
          <UButton type="button" color="neutral" variant="soft" :disabled="deleting" @click="open = false">Annuler</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { apiErrorMessage } from '~/utils/apiErrors'
import { useGameFocus } from '@/composables/useGameFocus'

const props = defineProps<{ game: { id: string, title: string } }>()
const open = defineModel<boolean>('open', { required: true })

const typed = ref('')
const mismatch = ref(false)
const deleting = ref(false)
const error = ref('')
const { game: currentGame, clearGame } = useGameFocus()

watch(open, (value) => {
  if (!value) return
  typed.value = ''
  mismatch.value = false
  error.value = ''
})

async function remove() {
  mismatch.value = typed.value.trim() !== props.game.title.trim()
  if (mismatch.value) return
  deleting.value = true
  error.value = ''
  try {
    // Hors ligne, la suppression part en file, comme celle d'un élément (ADR-0036)
    await useApiFetch(`/api/games/${props.game.id}`, { method: 'DELETE' })
    if (currentGame.value?.id === props.game.id) clearGame()
    open.value = false
    await navigateTo('/games')
  } catch (err) {
    error.value = apiErrorMessage(err, 'La suppression a échoué.')
  } finally {
    deleting.value = false
  }
}
</script>
