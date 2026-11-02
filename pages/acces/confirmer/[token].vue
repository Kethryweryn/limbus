<template>
  <AccessCard title="Confirmation de l’adresse">
    <p v-if="pending" class="text-sm text-gray-500">Confirmation en cours…</p>
    <div v-else-if="error" class="space-y-3">
      <UAlert color="error" variant="soft" :description="error" />
    </div>
    <div v-else class="space-y-3">
      <UAlert
        color="success"
        variant="soft"
        :description="newEmail ? `Votre compte utilise désormais l’adresse ${newEmail}.` : 'Votre adresse est confirmée : votre compte est actif.'"
      />
      <UButton color="primary" @click="openApp">Ouvrir Limbus</UButton>
    </div>
  </AccessCard>
</template>

<script setup lang="ts">
import { serverMessage } from '~/utils/apiErrors'

// Lien de confirmation : inscription (US-061) ou nouvelle adresse (US-063). Le clic connecte
definePageMeta({ layout: false })

const route = useRoute()
const pending = ref(true)
const error = ref('')
const newEmail = ref('')

onMounted(async () => {
  try {
    const result = await $fetch('/api/auth/confirm', { method: 'POST', body: { token: String(route.params.token || '') } })
    newEmail.value = 'email' in result ? result.email ?? '' : ''
  } catch (err) {
    error.value = serverMessage(err, 'Ce lien n’est pas valable.')
  } finally {
    pending.value = false
  }
})

// Rechargement complet : l'application relit le compte connecté
function openApp() {
  window.location.replace(newEmail.value ? '/compte' : '/')
}
</script>
