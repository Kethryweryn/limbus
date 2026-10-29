<template>
  <div class="p-6 space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Utilisateurs</h1>
      <p class="text-sm text-gray-500">
        Gestion des comptes ayant accès à Limbus.
      </p>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Créer un utilisateur</h2>
      </template>

      <p class="text-sm text-gray-500 mb-3">La personne reçoit un lien pour choisir son mot de passe, valable 7 jours.</p>
      <form class="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end" autocomplete="off" @submit.prevent="createUser">
        <UFormField label="Nom">
          <UInput v-model="newUser.name" required autocomplete="off" name="new-user-display-name" />
        </UFormField>
        <UFormField label="Email">
          <UInput v-model="newUser.email" type="email" required autocomplete="off" name="new-user-contact-email" />
        </UFormField>
        <UFormField label="Rôle">
          <USelect v-model="newUser.role" :items="USER_ROLE_OPTIONS" value-key="value" />
        </UFormField>
        <UButton type="submit" color="primary" :loading="saving">
          Créer
        </UButton>
      </form>
    </UCard>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <UCard v-for="user in users" :key="user.id">
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-semibold">{{ user.name }}</h2>
              <p class="text-sm text-gray-500">{{ user.email }}</p>
            </div>
            <div class="flex flex-wrap justify-end gap-1">
              <UBadge v-if="user.disabledAt" color="error" variant="solid">Désactivé</UBadge>
              <UBadge v-else-if="!user.emailConfirmedAt" color="neutral" variant="subtle">Adresse non confirmée</UBadge>
              <UBadge :color="user.role === USER_ROLES.admin ? 'warning' : 'primary'" variant="subtle">
                {{ user.role === USER_ROLES.admin ? 'Administratrice' : 'Compte' }}
              </UBadge>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UFormField label="Nom">
              <UInput v-model="user.name" autocomplete="off" :name="`managed-user-name-${user.id}`" />
            </UFormField>
            <UFormField label="Email">
              <UInput v-model="user.email" type="email" autocomplete="off" :name="`managed-user-email-${user.id}`" />
            </UFormField>
            <UFormField label="Rôle">
              <USelect v-model="user.role" :items="USER_ROLE_OPTIONS" value-key="value" />
            </UFormField>
            <UFormField label="Plafond de stockage (Mo)" :help="`${formatMb(user.storageUsedBytes)} utilisés`">
              <UInput v-model.number="user.storageQuotaMb" type="number" min="0" />
            </UFormField>
          </div>

          <div class="text-sm text-gray-500">
            {{ user.ownedGames?.length || 0 }} jeu(x) possédé(s),
            {{ user.gameShares?.length || 0 }} partage(s)
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton color="primary" size="sm" :loading="savingUserId === user.id" @click="updateUser(user)">
              Enregistrer
            </UButton>
            <UButton color="neutral" variant="soft" size="sm" :disabled="Boolean(user.disabledAt)" @click="sendPasswordLink(user)">
              Envoyer un lien de mot de passe
            </UButton>
            <UButton color="warning" variant="soft" size="sm" :disabled="authState?.user?.id === user.id" @click="toggleDisabled(user)">
              {{ user.disabledAt ? 'Réactiver' : 'Désactiver' }}
            </UButton>
            <UButton color="error" variant="soft" size="sm" :disabled="authState?.user?.id === user.id" @click="deleteUser(user)">
              Supprimer
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <p v-if="notice" class="text-sm text-green-700">{{ notice }}</p>
    <p v-if="serverError" class="text-sm text-red-500">{{ serverError }}</p>
  </div>
</template>

<script setup>
import { USER_ROLES, USER_ROLE_OPTIONS } from '~/utils/domain'

const users = ref([])
const saving = ref(false)
const savingUserId = ref('')
const serverError = ref('')
const notice = ref('')
const { data: authState } = await useFetch('/api/auth/me')

const newUser = ref({
  name: '',
  email: '',
  role: USER_ROLES.user
})

function formatMb(bytes) {
  return `${((bytes || 0) / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}

async function fetchUsers() {
  users.value = await useApiFetch('/api/admin/users')
}

async function createUser() {
  saving.value = true
  serverError.value = ''
  try {
    await useApiFetch('/api/admin/users', {
      method: 'POST',
      body: newUser.value
    })
    notice.value = `Compte créé : ${newUser.value.email} a reçu un lien pour choisir son mot de passe.`
    newUser.value = {
      name: '',
      email: '',
      role: USER_ROLES.user
    }
    await fetchUsers()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    saving.value = false
  }
}

async function updateUser(user) {
  savingUserId.value = user.id
  serverError.value = ''
  try {
    await useApiFetch(`/api/admin/users/${user.id}`, {
      method: 'PUT',
      body: {
        name: user.name,
        email: user.email,
        role: user.role,
        storageQuotaMb: Number(user.storageQuotaMb)
      }
    })
    await fetchUsers()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    savingUserId.value = ''
  }
}

async function sendPasswordLink(user) {
  serverError.value = ''
  notice.value = ''
  try {
    await useApiFetch(`/api/admin/users/${user.id}/password-link`, { method: 'POST' })
    notice.value = `Lien envoyé à ${user.email}, valable 7 jours.`
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}

// Désactiver déconnecte le compte et bloque sa connexion ; ses jeux restent à leurs co-organisatrices (US-065)
async function toggleDisabled(user) {
  const disabled = !user.disabledAt
  if (disabled && !confirm(`Désactiver ${user.name} ? Le compte sera déconnecté et ne pourra plus se connecter.`)) return
  serverError.value = ''
  notice.value = ''
  try {
    await useApiFetch(`/api/admin/users/${user.id}`, { method: 'PUT', body: { disabled } })
    await fetchUsers()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}

async function deleteUser(user) {
  if (!confirm(`Supprimer ${user.name} ?`)) return

  serverError.value = ''
  try {
    await useApiFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    await fetchUsers()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}

await fetchUsers()
</script>
