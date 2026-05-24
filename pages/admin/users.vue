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

      <form class="grid grid-cols-1 lg:grid-cols-5 gap-3 items-end" @submit.prevent="createUser">
        <UFormField label="Nom">
          <UInput v-model="newUser.name" required />
        </UFormField>
        <UFormField label="Email">
          <UInput v-model="newUser.email" type="email" required />
        </UFormField>
        <UFormField label="Mot de passe">
          <UInput v-model="newUser.password" type="password" required />
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
            <UBadge :color="user.role === USER_ROLES.admin ? 'warning' : 'primary'" variant="subtle">
              {{ user.role === USER_ROLES.admin ? 'Administrateur' : 'Organisateur' }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UFormField label="Nom">
              <UInput v-model="user.name" />
            </UFormField>
            <UFormField label="Email">
              <UInput v-model="user.email" type="email" />
            </UFormField>
            <UFormField label="Rôle">
              <USelect v-model="user.role" :items="USER_ROLE_OPTIONS" value-key="value" />
            </UFormField>
            <UFormField label="Nouveau mot de passe">
              <UInput v-model="user.password" type="password" placeholder="Laisser vide pour ne pas changer" />
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
            <UButton color="error" variant="soft" size="sm" :disabled="authState?.user?.id === user.id" @click="deleteUser(user)">
              Supprimer
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <p v-if="serverError" class="text-sm text-red-500">{{ serverError }}</p>
  </div>
</template>

<script setup>
import { USER_ROLES, USER_ROLE_OPTIONS } from '~/utils/domain'

const users = ref([])
const saving = ref(false)
const savingUserId = ref('')
const serverError = ref('')
const { data: authState } = await useFetch('/api/auth/me')

const newUser = ref({
  name: '',
  email: '',
  password: '',
  role: USER_ROLES.organizer
})

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
    newUser.value = {
      name: '',
      email: '',
      password: '',
      role: USER_ROLES.organizer
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
        password: user.password || undefined
      }
    })
    user.password = ''
    await fetchUsers()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    savingUserId.value = ''
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
