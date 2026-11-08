<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-6">
    <UCard class="w-full max-w-xl">
      <template #header>
        <div>
          <h1 class="text-xl font-semibold">{{ isBequest ? 'Un jeu vous est légué' : 'Invitation Limbus' }}</h1>
          <p v-if="invitation && isBequest" class="text-sm text-gray-500">
            {{ invitation.inviterName }} vous lègue une copie de son jeu « {{ invitation.game.title }} ».
            Elle vous appartiendra dès votre compte créé, et vous pourrez la modifier librement.
          </p>
          <p v-else-if="invitation" class="text-sm text-gray-500">
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

        <div v-if="currentUser" class="space-y-3">
          <p class="text-sm text-gray-600">
            Vous êtes connecté avec {{ currentUser.email }}.
          </p>
          <UAlert
            v-if="wrongAccount"
            color="warning"
            variant="soft"
            description="Cette invitation a été envoyée à une autre adresse : seul le compte de cette adresse peut l’accepter. Demandez une nouvelle invitation pour votre compte, ou déconnectez-vous."
          />
          <UButton v-else color="primary" :loading="saving" @click="acceptInvitation">
            {{ isBequest ? 'Recevoir la copie' : 'Accepter l’invitation' }}
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
            <UFormField label="Email" help="L’adresse de l’invitation.">
              <UInput :model-value="invitation.email" type="email" disabled />
            </UFormField>
            <UFormField label="Mot de passe" help="8 caractères au moins.">
              <PasswordInput v-model="form.password" required minlength="8" autocomplete="new-password" />
            </UFormField>
            <!-- Conditions d'utilisation (US-111) -->
            <UCheckbox v-model="form.termsAccepted" required>
              <template #label>
                J’accepte les <NuxtLink to="/conditions" target="_blank" class="text-primary underline">conditions d’utilisation</NuxtLink>
                et j’ai lu la <NuxtLink to="/confidentialite" target="_blank" class="text-primary underline">politique de confidentialité</NuxtLink>
              </template>
            </UCheckbox>
            <UButton type="submit" color="primary" :loading="saving">
              {{ isBequest ? 'Créer mon compte et recevoir la copie' : 'Créer mon compte et accepter' }}
            </UButton>
          </form>

          <form v-else class="space-y-3" @submit.prevent="loginAndAccept">
            <UFormField label="Email">
              <UInput v-model="loginForm.email" type="email" required />
            </UFormField>
            <UFormField label="Mot de passe">
              <PasswordInput v-model="loginForm.password" required />
            </UFormField>
            <UButton type="submit" color="primary" :loading="saving">
              {{ isBequest ? 'Me connecter et recevoir la copie' : 'Me connecter et accepter' }}
            </UButton>
          </form>
        </div>

        <p v-if="serverError" class="text-sm text-red-500">{{ serverError }}</p>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { serverMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

definePageMeta({
  layout: false
})

const route = useRoute()
const token = String(route.params.token || '')
const pending = ref(true)
const invitation = ref<ApiResponse<'/api/invitations/:token'> | null>(null)
const loadError = ref('')
const serverError = ref('')
const saving = ref(false)
const mode = ref<'register' | 'login'>('register')
const form = ref({
  name: '',
  password: '',
  termsAccepted: false
})
const loginForm = ref({
  email: '',
  password: ''
})
const { data: authState } = await useFetch('/api/auth/me')
const normalizeEmail = (email: string | null | undefined) => String(email || '').trim().toLowerCase()
const currentUser = computed(() => authState.value?.authenticated ? authState.value.user : null)
const normalizedAuthEmail = computed(() => normalizeEmail(currentUser.value?.email))
const normalizedInvitationEmail = computed(() => normalizeEmail(invitation.value?.email))
// Seul le compte de l'adresse invitée accepte (US-064)
const wrongAccount = computed(() => normalizedAuthEmail.value !== normalizedInvitationEmail.value)
// Legs d'une copie à une personne sans compte (US-011)
const isBequest = computed(() => invitation.value?.kind === 'bequest')

try {
  const loaded = await publicFetch<ApiResponse<'/api/invitations/:token'>>(`/api/invitations/${token}`)
  invitation.value = loaded
  loginForm.value.email = loaded.email
} catch (err) {
  loadError.value = serverMessage(err, 'Invitation introuvable')
} finally {
  pending.value = false
}

async function loginAndAccept() {
  saving.value = true
  serverError.value = ''
  try {
    await publicFetch('/api/auth/login', { method: 'POST', body: loginForm.value })
    await acceptInvitation()
  } catch (err) {
    serverError.value = serverMessage(err, 'Impossible de se connecter')
  } finally {
    saving.value = false
  }
}

async function acceptInvitation() {
  saving.value = true
  serverError.value = ''
  try {
    const result = await publicFetch<ApiResponse<'/api/invitations/accept', 'post'>>('/api/invitations/accept', { method: 'POST', body: { token } })
    await navigateTo(`/games/${result.game.slug}`)
  } catch (err) {
    serverError.value = serverMessage(err, 'Impossible d’accepter l’invitation')
  } finally {
    saving.value = false
  }
}

async function register() {
  saving.value = true
  serverError.value = ''
  try {
    const result = await publicFetch<ApiResponse<'/api/auth/register', 'post'>>('/api/auth/register', {
      method: 'POST',
      body: {
        token,
        name: form.value.name,
        password: form.value.password,
        termsAccepted: form.value.termsAccepted
      }
    })
    await navigateTo(`/games/${result.game.slug}`)
  } catch (err) {
    serverError.value = serverMessage(err, 'Impossible de créer le compte')
  } finally {
    saving.value = false
  }
}
</script>
