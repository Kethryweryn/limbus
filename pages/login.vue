<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-100 p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-bold">Se connecter</h1>
      </template>

      <div v-if="checking">
        <div class="flex items-center justify-center py-8">
          <UIcon name="i-heroicons-arrow-path-20-solid" class="animate-spin h-6 w-6 text-gray-500" />
          <span class="ml-2 text-sm text-gray-500">Vérification de l’authentification…</span>
        </div>
      </div>

      <form v-else @submit.prevent="onSubmit" class="space-y-4">
        <UInput v-model="email" type="email" label="Adresse e-mail" placeholder="exemple@limbus.gn" />
        <UInput v-model="password" type="password" label="Mot de passe" placeholder="••••••••" />
        <UButton type="submit" block>Envoyer</UButton>
      </form>

      <template #footer>
        <p v-if="message" class="text-sm text-green-600 mt-4 text-center">
          {{ message }}
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const email = ref('')
const password = ref('')
const message = ref('')
const checking = ref(true)

const onSubmit = async () => {
  try {
    const res = await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value
      },
      credentials: 'include'
    })

    if (res.success) {
      message.value = `Bienvenue !`
      return navigateTo('/dashboard')
    } else {
      message.value = res.message
    }
  } catch (err) {
    console.error('Erreur API', err)
    message.value = 'Erreur serveur'
  }
}

onMounted(async () => {
  try {
    const res = await $fetch('/api/auth/me', {
      credentials: 'include'
    })

    if (res.authenticated) {
      return navigateTo('/dashboard')
    }
  } catch (e) {
    // Silencieux
  } finally {
    checking.value = false
  }
})
</script>