<script setup lang="ts">
// Compte dont l'adresse n'est pas confirmée (US-061, R5) : renvoyer le lien ou se déconnecter
const props = defineProps<{ email: string }>()

const sending = ref(false)
const message = ref('')
const error = ref('')

async function resend() {
  sending.value = true
  message.value = ''
  error.value = ''
  try {
    const result = await $fetch('/api/auth/resend-confirmation', { method: 'POST' })
    if (result.alreadyConfirmed) {
      window.location.reload()
      return
    }
    message.value = `Un nouveau lien est parti à ${props.email}.`
  } catch (err: any) {
    error.value = err?.data?.message || 'Impossible d’envoyer le lien.'
  } finally {
    sending.value = false
  }
}

// Rien n'a été gardé sur l'appareil pour ce compte : il suffit d'effacer le cookie
async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
  window.location.replace('/')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 flex items-center justify-center">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-semibold">Confirmez votre adresse</h1>
      </template>
      <div class="space-y-4">
        <p class="text-sm text-gray-600">
          Un lien de confirmation a été envoyé à <strong>{{ email }}</strong>. Ouvrez-le pour activer votre compte.
          Sans confirmation, le compte est supprimé au bout de 7 jours.
        </p>
        <UAlert v-if="message" color="success" variant="soft" :description="message" />
        <UAlert v-if="error" color="error" variant="soft" :description="error" />
        <div class="flex flex-wrap gap-2">
          <UButton color="primary" :loading="sending" @click="resend">
            Renvoyer le lien
          </UButton>
          <UButton color="neutral" variant="soft" @click="logout">
            Se déconnecter
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
