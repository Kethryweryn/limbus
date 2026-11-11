<template>
  <main class="light min-h-screen bg-gray-50 px-4 py-8 text-gray-900" style="color-scheme: light;">
    <div class="mx-auto max-w-xl">
      <UCard>
        <template #header>
          <h1 class="text-xl font-semibold">Confirmer votre adresse</h1>
        </template>
        <div v-if="email" class="space-y-3">
          <UAlert color="success" variant="soft" :description="`L’adresse ${email} est confirmée : vos inscriptions sont réunies sous cette adresse.`" />
          <p class="text-sm text-gray-600">Les prochains emails de Limbus vous arriveront à cette adresse.</p>
        </div>
        <div v-else class="space-y-4">
          <p class="text-sm text-gray-700">
            Cette adresse a été donnée en réponse à une invitation sur Limbus. Si c’est la vôtre, confirmez-le : vos inscriptions seront réunies sous cette adresse.
          </p>
          <UAlert v-if="error" color="error" variant="soft" :description="error" />
          <UButton color="primary" :loading="saving" @click="confirmAddress">C’est bien mon adresse</UButton>
        </div>
      </UCard>
    </div>
  </main>
</template>

<script setup lang="ts">
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

// Lien de preuve d'une adresse donnée en réponse (US-243, ADR-0087) : la preuve attend le clic, pour qu'un logiciel qui
// ouvre les liens d'un email ne prouve rien. Rien de l'autre fiche n'est montré
definePageMeta({
  layout: false,
  colorMode: 'light'
})

useHead({
  title: 'Confirmer votre adresse - Limbus',
  meta: [
    { name: 'referrer', content: 'no-referrer' },
    { name: 'robots', content: 'noindex' },
    { name: 'color-scheme', content: 'light' }
  ],
  htmlAttrs: { class: 'light', 'data-color-mode-forced': 'light' },
  bodyAttrs: { class: 'bg-gray-50 text-gray-900' }
})

const route = useRoute()
const email = ref('')
const error = ref('')
const saving = ref(false)

async function confirmAddress() {
  saving.value = true
  error.value = ''
  try {
    const token = String(route.params.token || '')
    // Au clic, pas au montage : une erreur de réseau se réessaie en cliquant de nouveau
    const result = await publicFetch<ApiResponse<'/api/public/email-proofs/:token', 'post'>>(`/api/public/email-proofs/${encodeURIComponent(token)}`, { method: 'POST' })
    email.value = result.email
  } catch (err) {
    error.value = apiErrorMessage(err, 'Ce lien n’est pas valable.')
  } finally {
    saving.value = false
  }
}
</script>
