<template>
  <!-- Supprimer depuis la fiche, en lecture comme en modification (US-186) : même confirmation que la liste, puis retour à
       la liste. Le serveur vérifie les droits, comme pour la liste -->
  <div class="flex flex-col items-end gap-1">
    <UButton icon="i-heroicons-trash" color="error" variant="soft" :loading="deleting" @click="remove">
      Supprimer
    </UButton>
    <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { apiErrorMessage } from '~/utils/apiErrors'

const props = defineProps<{
  // Route de l'API qui supprime l'élément, par son identifiant
  url: string
  confirmText: string
  // Page où revenir : la liste, ou la session d'où l'on vient
  listPath: RouteLocationRaw
}>()

const deleting = ref(false)
const error = ref('')

async function remove() {
  if (!confirm(props.confirmText)) return
  deleting.value = true
  error.value = ''
  try {
    // Hors ligne, la suppression part en file (ADR-0036) : la fiche se quitte aussi
    await useApiFetch(props.url, { method: 'DELETE' })
    await navigateTo(props.listPath)
  } catch (err) {
    error.value = apiErrorMessage(err, 'La suppression a échoué.')
  } finally {
    deleting.value = false
  }
}
</script>
