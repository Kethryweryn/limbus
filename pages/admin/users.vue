<template>
  <div class="p-6 space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Utilisateurs</h1>
      <p class="text-sm text-gray-500">
        Gestion des comptes ayant accès à Limbus.
      </p>
    </div>

    <UAlert v-if="loadError" color="error" variant="soft" :description="loadError" />

    <UCard v-if="!loadError">
      <template #header>
        <h2 class="font-semibold">Créer un utilisateur</h2>
      </template>

      <p class="text-sm text-gray-500 mb-3">La personne reçoit un lien pour choisir son mot de passe, valable 7 jours.</p>
      <form class="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end" autocomplete="off" novalidate @submit.prevent="createUser">
        <UFormField label="Nom">
          <UInput v-model="newUser.name" autocomplete="off" name="new-user-display-name" />
        </UFormField>
        <UFormField label="Email">
          <UInput v-model="newUser.email" type="email" autocomplete="off" name="new-user-contact-email" />
        </UFormField>
        <UFormField label="Rôle">
          <USelect v-model="newUser.role" :items="roleItems" value-key="value" />
        </UFormField>
        <UButton type="submit" color="primary" :loading="saving">
          Créer
        </UButton>
      </form>
      <FormFeedback :result="resultFor('create')" />
    </UCard>

    <!-- Comptes non activés (US-248) : pré-créés pour une fiche ou inscriptions jamais confirmées, masqués par défaut -->
    <UCheckbox v-if="!loadError" v-model="showInactive" :label="`Afficher les comptes non activés (${inactiveCount})`" />

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <UCard v-for="user in visibleUsers" :key="user.id">
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-semibold">{{ user.name || 'Sans nom' }}</h2>
              <p class="text-sm text-gray-500">{{ user.email }}</p>
            </div>
            <div class="flex flex-wrap justify-end gap-1">
              <UBadge v-if="user.disabledAt" color="error" variant="solid">Désactivé</UBadge>
              <UBadge v-else-if="!user.emailConfirmedAt" color="neutral" variant="subtle">Non activé</UBadge>
              <UBadge :color="user.role === USER_ROLES.admin ? 'warning' : 'primary'" variant="subtle">
                {{ user.role === USER_ROLES.admin ? 'Administratrice' : 'Compte' }}
              </UBadge>
            </div>
          </div>
        </template>

        <!-- Lecture seule (US-248) : la personne l'active elle-même, ou l'administratrice le reprend en le créant -->
        <p v-if="!user.emailConfirmedAt" class="text-sm text-gray-500">
          Ce compte n’est pas activé : la personne l’active elle-même, ou créez un compte à son adresse pour le reprendre.
        </p>
        <div v-else class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UFormField label="Nom">
              <UInput v-model="user.name" autocomplete="off" :name="`managed-user-name-${user.id}`" />
            </UFormField>
            <UFormField label="Email">
              <UInput v-model="user.email" type="email" autocomplete="off" :name="`managed-user-email-${user.id}`" />
            </UFormField>
            <UFormField label="Rôle">
              <USelect v-model="user.role" :items="roleItems" value-key="value" />
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
            <UButton color="warning" variant="soft" size="sm" :disabled="currentUserId === user.id" @click="toggleDisabled(user)">
              {{ user.disabledAt ? 'Réactiver' : 'Désactiver' }}
            </UButton>
            <UButton color="error" variant="soft" size="sm" :disabled="currentUserId === user.id" @click="deleteUser(user)">
              Supprimer
            </UButton>
          </div>
          <FormFeedback :result="resultFor(user.id)" />
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { USER_ROLES, USER_ROLE_OPTIONS } from '~/utils/domain'
import { loadErrorMessage } from '~/utils/apiErrors'
import { formatMegabytes as formatMb } from '~/utils/fileSizes'
import type { ApiResponse } from '~/composables/useApiFetch'

type ManagedUser = ApiResponse<'/api/admin/users'>[number]

const users = ref<ManagedUser[]>([])
const showInactive = ref(false)
const inactiveCount = computed(() => users.value.filter((user) => !user.emailConfirmedAt).length)
const visibleUsers = computed(() => showInactive.value ? users.value : users.value.filter((user) => user.emailConfirmedAt))
const saving = ref(false)
const savingUserId = ref('')
const loadError = ref('')
// Résultat de la dernière action, dans la carte de la création ('create') ou du compte touché (US-216)
const { resultFor, run } = useFormResult<string>()
const { data: authState } = await useFetch('/api/auth/me')
const currentUserId = computed(() => authState.value?.authenticated ? authState.value.user.id : null)
const roleItems: Array<{ label: string, value: string }> = [...USER_ROLE_OPTIONS]

const emptyUser = () => ({ name: '', email: '', role: USER_ROLES.user as string })
const newUser = ref(emptyUser())

async function fetchUsers() {
  users.value = await useApiFetch('/api/admin/users')
}

async function createUser() {
  saving.value = true
  await run('create', async () => {
    const created = await useApiAction('/api/admin/users', {
      method: 'POST',
      body: newUser.value
    })
    newUser.value = emptyUser()
    await fetchUsers()
    return created.emailSent
      ? `Compte créé : ${created.email} a reçu un lien pour choisir son mot de passe.`
      : `Compte créé, mais l’email n’est pas parti : utilisez « Envoyer un lien de mot de passe » sur la fiche de ${created.email}.`
  })
  saving.value = false
}

async function updateUser(user: ManagedUser) {
  savingUserId.value = user.id
  await run(user.id, async () => {
    await useApiAction(`/api/admin/users/${user.id}`, {
      method: 'PUT',
      body: {
        name: user.name,
        email: user.email,
        role: user.role,
        // Champ vidé : le plafond ne change pas (v-model.number laisse une chaîne vide)
        storageQuotaMb: Number.isFinite(user.storageQuotaMb) ? user.storageQuotaMb : undefined
      }
    })
    await fetchUsers()
    return 'Compte enregistré.'
  })
  savingUserId.value = ''
}

const sendPasswordLink = (user: ManagedUser) => run(user.id, async () => {
  await useApiAction(`/api/admin/users/${user.id}/password-link`, { method: 'POST' })
  return `Lien envoyé à ${user.email}, valable 7 jours.`
})

// Désactiver déconnecte le compte et bloque sa connexion ; ses jeux restent à leurs co-organisatrices (US-065)
async function toggleDisabled(user: ManagedUser) {
  const disabled = !user.disabledAt
  if (disabled && !confirm(`Désactiver ${user.name} ? Le compte sera déconnecté et ne pourra plus se connecter.`)) return
  // Le badge « Désactivé » et le bouton suffisent à confirmer
  await run(user.id, async () => {
    await useApiAction(`/api/admin/users/${user.id}`, { method: 'PUT', body: { disabled } })
    await fetchUsers()
    return null
  })
}

async function deleteUser(user: ManagedUser) {
  if (!confirm(`Supprimer ${user.name} ?`)) return
  // La carte disparaît : c'est la confirmation
  await run(user.id, async () => {
    await useApiAction(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    await fetchUsers()
    return null
  })
}

// Refus du serveur (403 pour qui n'administre pas) : affiché au lieu d'une page vide (US-215)
await fetchUsers().catch((err: unknown) => {
  loadError.value = loadErrorMessage(err, 'Impossible de charger les comptes.')
})
</script>
