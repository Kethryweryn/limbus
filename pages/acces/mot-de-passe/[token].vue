<template>
  <AccessCard title="Choisir mon mot de passe">
    <form class="space-y-4" @submit.prevent="save">
      <UFormField label="Nouveau mot de passe" help="8 caractères au moins.">
        <UInput v-model="password" type="password" required minlength="8" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UFormField label="Confirmation">
        <UInput v-model="confirmation" type="password" required autocomplete="new-password" class="w-full" />
      </UFormField>
      <UButton type="submit" color="primary" size="lg" block :loading="saving">
        Enregistrer et me connecter
      </UButton>
      <UAlert v-if="error" color="error" variant="soft" :description="error" />
    </form>
  </AccessCard>
</template>

<script setup>
// Lien de mot de passe : oublié (US-062) ou compte créé par l'administratrice (US-065)
definePageMeta({ layout: false })

const route = useRoute()
const password = ref('')
const confirmation = ref('')
const saving = ref(false)
const error = ref('')

async function save() {
  error.value = ''
  if (password.value !== confirmation.value) {
    error.value = 'Les deux mots de passe ne correspondent pas.'
    return
  }
  saving.value = true
  try {
    await $fetch('/api/auth/password-reset', { method: 'POST', body: { token: String(route.params.token || ''), password: password.value } })
    window.location.replace('/')
  } catch (err) {
    error.value = err?.data?.message || 'Impossible d’enregistrer le mot de passe.'
  } finally {
    saving.value = false
  }
}
</script>
