<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">Fiche allergies</h2>
          <p v-if="sheet" class="text-sm text-gray-500">{{ sheet.summary }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-heroicons-document-arrow-down"
            color="neutral"
            variant="soft"
            :href="sessionReads.allergiesPdf(sessionId)"
            target="_blank"
            external
          >
            PDF
          </UButton>
          <UButton
            icon="i-heroicons-envelope"
            color="primary"
            variant="soft"
            :loading="sending"
            @click="send"
          >
            Envoyer à l’équipe cuisine
          </UButton>
        </div>
      </div>
    </template>

    <UAlert v-if="errorMessage" color="error" variant="soft" class="mb-3" :description="errorMessage" />
    <UAlert
      v-if="infoMessage"
      :color="infoColor"
      variant="soft"
      class="mb-3"
      :description="infoMessage"
      :close="{ color: 'neutral', variant: 'link' }"
      @update:open="infoMessage = ''"
    />

    <p v-if="!sheet && !errorMessage" class="text-sm text-gray-500">Chargement…</p>
    <ul v-else-if="sheet?.people.length" class="divide-y divide-gray-100 text-sm">
      <li v-for="(person, index) in sheet.people" :key="index" class="py-2">
        <div class="font-medium text-gray-800">{{ person.name }}</div>
        <p class="whitespace-pre-line text-gray-600">{{ person.dietary }}</p>
      </li>
    </ul>
    <p v-else-if="sheet" class="text-sm text-gray-500">Aucune allergie ni intolérance déclarée.</p>
    <p class="mt-3 text-xs text-gray-500">
      Données de santé des personnes confirmées, générées à la demande et jamais stockées : la fiche suit les annulations.
    </p>
  </UCard>
</template>

<script setup lang="ts">
import { apiErrorMessage } from '~/utils/apiErrors'
import { sessionReads } from '~/utils/offlinePlan'

// Fiche allergies de la session (US-008, R15), destinée à l'équipe cuisine
import type { ApiResponse } from '~/composables/useApiFetch'
import type { UiColor } from '~/utils/ui'

const props = defineProps<{ sessionId: string }>()

const sheet = ref<ApiResponse<'/api/sessions/:id/allergies'> | null>(null)
const errorMessage = ref('')
const infoMessage = ref('')
const infoColor = ref<UiColor>('success')
const sending = ref(false)

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

async function load() {
  try {
    sheet.value = await useApiFetch(sessionReads.allergies(props.sessionId), { offlineCache: true })
    errorMessage.value = ''
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Impossible de charger la fiche allergies')
  }
}

async function send() {
  // Hors ligne, l'envoi serait mis en file comme une écriture : on le refuse plutôt
  if (!navigator.onLine) {
    errorMessage.value = 'Envoi impossible hors ligne.'
    return
  }
  if (!confirm('Envoyer la fiche allergies, en PDF, à chaque membre de l’équipe cuisine de la session ?')) return
  sending.value = true
  errorMessage.value = ''
  try {
    const result = await useApiAction(`/api/sessions/${props.sessionId}/allergies/send`, { method: 'POST' })
    infoColor.value = result.failures.length ? 'warning' : 'success'
    infoMessage.value = [
      `Fiche envoyée à ${plural(result.sentCount, 'membre')} de l’équipe cuisine.`,
      result.failures.length ? `Non envoyée à : ${result.failures.join(', ')}.` : ''
    ].filter(Boolean).join(' ')
    await load()
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Envoi impossible')
  } finally {
    sending.value = false
  }
}

onMounted(load)
</script>
