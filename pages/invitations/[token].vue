<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-6">
    <UCard class="w-full max-w-xl">
      <template #header>
        <div>
          <h1 class="text-xl font-semibold">Invitation Limbus</h1>
          <p v-if="invitation" class="text-sm text-gray-500">
            Accès au jeu {{ invitation.game.title }}
          </p>
        </div>
      </template>

      <div v-if="pending" class="text-sm text-gray-500">Chargement...</div>
      <div v-else-if="loadError" class="space-y-3">
        <UAlert color="error" variant="soft" :description="loadError" />
        <UButton to="/login" color="neutral" variant="soft">Connexion</UButton>
      </div>
      <div v-else-if="invitation" class="space-y-5">
        <UAlert
          color="primary"
          variant="soft"
          :description="`Cette invitation est destinée à ${invitation.email}.`"
        />

        <div v-if="authState?.authenticated" class="space-y-3">
          <p class="text-sm text-gray-600">
            Vous êtes connecté avec {{ authState.user.email }}.
          </p>
          <UButton color="primary" :loading="saving" @click="acceptInvitation">
            Accepter l’invitation
          </UButton>
        </div>

        <form v-else class="space-y-3" @submit.prevent="register">
          <UFormField label="Nom">
            <UInput v-model="form.name" required />
          </UFormField>
          <UFormField label="Email">
            <UInput :model-value="invitation.email" type="email" disabled />
          </UFormField>
          <UFormField label="Mot de passe">
            <UInput v-model="form.password" type="password" required />
          </UFormField>
          <UButton type="submit" color="primary" :loading="saving">
            Créer mon compte et accepter
          </UButton>
          <p class="text-sm text-gray-500">
            Si vous avez déjà un compte avec cette adresse, connectez-vous puis revenez sur ce lien.
          </p>
        </form>

        <p v-if="serverError" class="text-sm text-red-500">{{ serverError }}</p>
      </div>
    </UCard>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
})

const route = useRoute()
const token = String(route.params.token || '')
const pending = ref(true)
const invitation = ref(null)
const loadError = ref('')
const serverError = ref('')
const saving = ref(false)
const form = ref({
  name: '',
  password: ''
})
const { data: authState } = await useFetch('/api/auth/me')

try {
  invitation.value = await $fetch(`/api/invitations/${token}`)
} catch (err) {
  loadError.value = err?.data?.message || err?.statusMessage || 'Invitation introuvable'
} finally {
  pending.value = false
}

async function acceptInvitation() {
  saving.value = true
  serverError.value = ''
  try {
    const result = await $fetch('/api/invitations/accept', {
      method: 'POST',
      body: { token }
    })
    await navigateTo(`/games/${result.game.slug}`)
  } catch (err) {
    serverError.value = err?.data?.message || err?.statusMessage || 'Impossible d’accepter l’invitation'
  } finally {
    saving.value = false
  }
}

async function register() {
  saving.value = true
  serverError.value = ''
  try {
    const result = await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        token,
        name: form.value.name,
        password: form.value.password
      }
    })
    await navigateTo(`/games/${result.game.slug}`)
  } catch (err) {
    serverError.value = err?.data?.message || err?.statusMessage || 'Impossible de créer le compte'
  } finally {
    saving.value = false
  }
}
</script>
