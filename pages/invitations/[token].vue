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
          <UAlert
            v-if="normalizedAuthEmail !== normalizedInvitationEmail"
            color="warning"
            variant="soft"
            description="Cette invitation a été envoyée à une autre adresse email. Elle sera rattachée au compte actuellement connecté."
          />
          <UButton color="primary" :loading="saving" @click="acceptInvitation">
            Accepter l’invitation
          </UButton>
        </div>

        <div v-else class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <UButton
              :color="mode === 'register' ? 'primary' : 'neutral'"
              :variant="mode === 'register' ? 'solid' : 'soft'"
              size="sm"
              @click="mode = 'register'"
            >
              Créer mon compte
            </UButton>
            <UButton
              :color="mode === 'login' ? 'primary' : 'neutral'"
              :variant="mode === 'login' ? 'solid' : 'soft'"
              size="sm"
              @click="mode = 'login'"
            >
              J’ai déjà un compte
            </UButton>
          </div>

          <form v-if="mode === 'register'" class="space-y-3" @submit.prevent="register">
            <UFormField label="Nom">
              <UInput v-model="form.name" required />
            </UFormField>
            <UFormField label="Email">
              <UInput v-model="form.email" type="email" required />
            </UFormField>
            <UFormField label="Mot de passe">
              <UInput v-model="form.password" type="password" required />
            </UFormField>
            <UButton type="submit" color="primary" :loading="saving">
              Créer mon compte et accepter
            </UButton>
          </form>

          <form v-else class="space-y-3" @submit.prevent="loginAndAccept">
            <UFormField label="Email">
              <UInput v-model="loginForm.email" type="email" required />
            </UFormField>
            <UFormField label="Mot de passe">
              <UInput v-model="loginForm.password" type="password" required />
            </UFormField>
            <UButton type="submit" color="primary" :loading="saving">
              Me connecter et accepter
            </UButton>
          </form>
        </div>

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
const mode = ref('register')
const form = ref({
  email: '',
  name: '',
  password: ''
})
const loginForm = ref({
  email: '',
  password: ''
})
const { data: authState } = await useFetch('/api/auth/me')
const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizedAuthEmail = computed(() => normalizeEmail(authState.value?.user?.email))
const normalizedInvitationEmail = computed(() => normalizeEmail(invitation.value?.email))

try {
  invitation.value = await $fetch(`/api/invitations/${token}`)
  form.value.email = invitation.value.email
  loginForm.value.email = invitation.value.email
} catch (err) {
  loadError.value = err?.data?.message || err?.statusMessage || 'Invitation introuvable'
} finally {
  pending.value = false
}

async function loginAndAccept() {
  saving.value = true
  serverError.value = ''
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: loginForm.value
    })
    await acceptInvitation()
  } catch (err) {
    serverError.value = err?.data?.message || err?.statusMessage || 'Impossible de se connecter'
  } finally {
    saving.value = false
  }
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
        email: form.value.email,
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
