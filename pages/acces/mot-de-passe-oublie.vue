<template>
  <AccessCard title="Mot de passe oublié" subtitle="Recevez un lien pour choisir un nouveau mot de passe.">
    <UAlert
      v-if="done"
      color="success"
      variant="soft"
      :description="`Si un compte utilise ${email}, un lien vient d’y partir. Il est valable 1 heure.`"
    />
    <form v-else class="space-y-4" @submit.prevent="send">
      <UFormField label="Email">
        <UInput v-model="email" type="email" required autocomplete="email" class="w-full" />
      </UFormField>
      <UButton type="submit" color="primary" size="lg" block :loading="saving">
        Recevoir le lien
      </UButton>
      <UAlert v-if="error" color="error" variant="soft" :description="error" />
    </form>
  </AccessCard>
</template>

<script setup>
// Mot de passe oublié (US-062)
definePageMeta({ layout: false })

const email = ref('')
const saving = ref(false)
const done = ref(false)
const error = ref('')

async function send() {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/password-forgotten', { method: 'POST', body: { email: email.value } })
    done.value = true
  } catch (err) {
    error.value = err?.data?.message || 'Impossible d’envoyer le lien.'
  } finally {
    saving.value = false
  }
}
</script>
