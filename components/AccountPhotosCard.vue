<template>
  <!-- Photos (US-109, US-177) : retirer les siennes de tous ses jeux, et refuser les suivantes -->
  <UCard v-if="concerned || loadFailed">
    <template #header><h2 class="font-semibold">Mes photos</h2></template>
    <UAlert v-if="loadFailed" color="error" variant="soft" description="Impossible de lire votre réglage de photos. Rechargez la page pour réessayer." />
    <p v-else-if="refused" class="text-sm text-gray-600">
      Vous avez refusé l’usage de votre photo : les équipes ne peuvent pas en ajouter, et vos trombinoscopes n’en montrent pas.
    </p>
    <p v-else class="text-sm text-gray-600">
      Les équipes de vos jeux peuvent ajouter votre photo au trombinoscope de leurs sessions. Vous pouvez retirer vos photos de tous vos jeux, ce qui empêche aussi d’en ajouter.
    </p>
    <div v-if="!loadFailed" class="mt-3 flex items-center gap-3">
      <UButton
        :color="refused ? 'neutral' : 'error'"
        variant="soft"
        :loading="saving"
        @click="setRefusal(!refused)"
      >
        {{ refused ? 'Accepter de nouveau une photo' : 'Retirer mes photos' }}
      </UButton>
      <span v-if="message" class="text-sm text-gray-500">{{ message }}</span>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { serverMessage } from '~/utils/apiErrors'

const concerned = ref(false)
const loadFailed = ref(false)
const refused = ref(false)
const saving = ref(false)
const message = ref('')

onMounted(async () => {
  // Sans fiche chez une équipe, il n'y a ni photo à retirer, ni refus à poser : la carte reste masquée
  try {
    const state = await useApiFetch('/api/me/photo-refusal')
    concerned.value = state.concerned
    refused.value = state.refused
  } catch {
    loadFailed.value = true
  }
})

async function setRefusal(next: boolean) {
  if (next && !confirm('Retirer vos photos de tous vos jeux ? Les trombinoscopes déjà générés seront refaits sans elles.')) return
  saving.value = true
  message.value = ''
  try {
    await useApiAction('/api/me/photo-refusal', { method: 'POST', body: { refused: next } })
    refused.value = next
    message.value = next ? 'Vos photos sont retirées.' : 'Les équipes peuvent de nouveau ajouter votre photo.'
  } catch (err) {
    message.value = serverMessage(err, 'L’enregistrement a échoué.')
  } finally {
    saving.value = false
  }
}
</script>
