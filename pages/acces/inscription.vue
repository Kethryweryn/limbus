<template>
  <AccessCard title="Créer un compte" subtitle="Organisez vos GN avec Limbus.">
    <UAlert
      v-if="done"
      color="success"
      variant="soft"
      title="Vérifiez vos emails"
      :description="`Si l’adresse ${form.email} peut recevoir un compte, un lien de confirmation vient d’y partir. Il est valable 48 heures.`"
    />
    <UAlert v-else-if="closed" color="neutral" variant="soft" description="L’inscription n’est pas ouverte pour le moment." />
    <form v-else class="space-y-4" @submit.prevent="signup">
      <UFormField label="Nom">
        <UInput v-model="form.name" required autocomplete="name" class="w-full" />
      </UFormField>
      <UFormField label="Email">
        <UInput v-model="form.email" type="email" required autocomplete="email" class="w-full" />
      </UFormField>
      <UFormField label="Mot de passe" help="8 caractères au moins.">
        <UInput v-model="form.password" type="password" required minlength="8" autocomplete="new-password" class="w-full" />
      </UFormField>
      <!-- Champ piège (R6) : invisible pour une personne, rempli par les robots -->
      <div class="absolute -left-[9999px]" aria-hidden="true">
        <label>Site web <input v-model="form.website" type="text" name="website" tabindex="-1" autocomplete="off"></label>
      </div>
      <UButton type="submit" color="primary" size="lg" block :loading="saving">
        Créer mon compte
      </UButton>
      <UAlert v-if="error" color="error" variant="soft" :description="error" />
    </form>
  </AccessCard>
</template>

<script setup>
// Inscription libre (US-061)
definePageMeta({ layout: false })

const form = ref({ name: '', email: '', password: '', website: '' })
const saving = ref(false)
const done = ref(false)
const error = ref('')
const closed = ref(false)

onMounted(async () => {
  closed.value = !(await $fetch('/api/auth/signup').catch(() => ({ open: false }))).open
})

async function signup() {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/signup', { method: 'POST', body: form.value })
    done.value = true
  } catch (err) {
    error.value = err?.data?.message || 'Impossible de créer le compte.'
  } finally {
    saving.value = false
  }
}
</script>
