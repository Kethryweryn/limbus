<script setup lang="ts">
// Conditions d'utilisation à accepter (US-111, ADR-0055) : nouveau compte sans acceptation, ou nouvelle version
const emit = defineEmits<{ accepted: [] }>()

const saving = ref(false)
const error = ref('')

async function accept() {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/accept-terms', { method: 'POST' })
    emit('accepted')
  } catch (err: any) {
    error.value = err?.data?.message || 'L’acceptation n’a pas pu être enregistrée.'
  } finally {
    saving.value = false
  }
}

// La page de déconnexion efface aussi ce qui est gardé sur l'appareil
function logout() {
  window.location.replace('/logout')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 flex items-center justify-center">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-semibold">Conditions d’utilisation</h1>
      </template>
      <div class="space-y-4 text-sm text-gray-700">
        <p>
          Pour continuer à utiliser Limbus, lisez et acceptez les
          <NuxtLink to="/conditions" target="_blank" class="text-primary underline">conditions d’utilisation</NuxtLink>.
          La <NuxtLink to="/confidentialite" target="_blank" class="text-primary underline">politique de confidentialité</NuxtLink>
          dit ce qui est fait de vos données.
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton color="primary" :loading="saving" @click="accept">J’accepte</UButton>
          <UButton color="neutral" variant="soft" @click="logout">Me déconnecter</UButton>
        </div>
        <UAlert v-if="error" color="error" variant="soft" :description="error" />
      </div>
    </UCard>
  </div>
</template>
