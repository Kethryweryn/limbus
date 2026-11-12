<template>
  <AccessCard title="Activer mon compte" subtitle="Une équipe vous a inscrit à un jeu ? Un compte Limbus vous attend à votre adresse.">
    <UAlert
      v-if="done"
      color="success"
      variant="soft"
      :description="`Si un compte attend à l’adresse ${email}, un lien pour l’activer vient d’y partir. Il est valable 7 jours.`"
    />
    <form v-else class="space-y-4" novalidate @submit.prevent="send">
      <UFormField label="Email">
        <UInput v-model="email" type="email" autocomplete="email" class="w-full" />
      </UFormField>
      <UButton type="submit" color="primary" size="lg" block :loading="saving">
        Recevoir le lien
      </UButton>
      <UAlert v-if="error" color="error" variant="soft" :description="error" />
    </form>
  </AccessCard>
</template>

<script setup lang="ts">
// Activer mon compte (US-246, SPEC-022 R10) : la page des emails des équipes. La réponse ne dit pas si l'adresse a un
// compte ; l'adresse ne figure jamais dans l'URL
import { apiErrorMessage } from '~/utils/apiErrors'

definePageMeta({ layout: false })

const email = ref('')
const saving = ref(false)
const done = ref(false)
const error = ref('')

async function send() {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/activation-request', { method: 'POST', body: { email: email.value } })
    done.value = true
  } catch (err) {
    error.value = apiErrorMessage(err, 'Impossible d’envoyer le lien.')
  } finally {
    saving.value = false
  }
}
</script>
