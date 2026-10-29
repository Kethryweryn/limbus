<template>
  <div class="p-6 space-y-6 max-w-3xl">
    <div>
      <h1 class="text-2xl font-bold">Mon compte</h1>
      <p class="text-sm text-gray-500">Votre nom, votre adresse et votre mot de passe.</p>
    </div>

    <UAlert v-if="loadError" color="error" variant="soft" :description="loadError" />

    <template v-if="account">
      <UCard>
        <template #header><h2 class="font-semibold">Nom</h2></template>
        <form class="flex flex-col sm:flex-row gap-3 sm:items-end" @submit.prevent="saveName">
          <UFormField label="Nom" class="flex-1">
            <UInput v-model="name" required class="w-full" />
          </UFormField>
          <UButton type="submit" color="primary" :loading="saving === 'name'">Enregistrer</UButton>
        </form>
        <p v-if="messages.name" class="mt-2 text-sm text-green-700">{{ messages.name }}</p>
      </UCard>

      <UCard>
        <template #header><h2 class="font-semibold">Email</h2></template>
        <p class="text-sm text-gray-600 mb-3">Adresse actuelle : <strong>{{ account.email }}</strong></p>
        <UAlert
          v-if="account.pendingEmail"
          class="mb-3"
          color="info"
          variant="soft"
          :description="`Un lien de confirmation attend à ${account.pendingEmail} : l’adresse changera quand vous l’ouvrirez.`"
        />
        <form class="grid grid-cols-1 sm:grid-cols-2 gap-3" @submit.prevent="changeEmail">
          <UFormField label="Nouvelle adresse">
            <UInput v-model="emailForm.email" type="email" required autocomplete="email" class="w-full" />
          </UFormField>
          <UFormField label="Mot de passe actuel">
            <UInput v-model="emailForm.password" type="password" required autocomplete="current-password" class="w-full" />
          </UFormField>
          <div class="sm:col-span-2">
            <UButton type="submit" color="primary" :loading="saving === 'email'">Recevoir le lien de confirmation</UButton>
          </div>
        </form>
      </UCard>

      <UCard>
        <template #header><h2 class="font-semibold">Mot de passe</h2></template>
        <form class="grid grid-cols-1 sm:grid-cols-2 gap-3" @submit.prevent="changePassword">
          <UFormField label="Mot de passe actuel">
            <UInput v-model="passwordForm.currentPassword" type="password" required autocomplete="current-password" class="w-full" />
          </UFormField>
          <UFormField label="Nouveau mot de passe" help="8 caractères au moins. Vos autres appareils seront déconnectés.">
            <UInput v-model="passwordForm.password" type="password" required minlength="8" autocomplete="new-password" class="w-full" />
          </UFormField>
          <div class="sm:col-span-2">
            <UButton type="submit" color="primary" :loading="saving === 'password'">Changer le mot de passe</UButton>
          </div>
        </form>
        <p v-if="messages.password" class="mt-2 text-sm text-green-700">{{ messages.password }}</p>
      </UCard>

      <!-- Mes coordonnées (US-074) : une seule version, recopiée pour chaque équipe -->
      <UCard>
        <template #header>
          <h2 class="font-semibold">Mes coordonnées</h2>
          <p class="text-sm text-gray-500">Les équipes des jeux auxquels vous participez les voient pour leurs jeux seulement. Vous seul·e les modifiez.</p>
        </template>
        <form class="grid grid-cols-1 sm:grid-cols-2 gap-3" @submit.prevent="saveProfile">
          <UFormField label="Téléphone">
            <UInput v-model="profileForm.phone" type="tel" autocomplete="tel" class="w-full" />
          </UFormField>
          <div />
          <UFormField label="Contact d’urgence : nom">
            <UInput v-model="profileForm.emergencyContactName" class="w-full" />
          </UFormField>
          <UFormField label="Contact d’urgence : téléphone">
            <UInput v-model="profileForm.emergencyContactPhone" type="tel" class="w-full" />
          </UFormField>
          <UFormField label="Régime, allergies et intolérances" class="sm:col-span-2">
            <UTextarea v-model="profileForm.dietary" :rows="3" class="w-full" />
          </UFormField>
          <UFormField v-if="profileForm.dietary?.trim()" class="sm:col-span-2">
            <UCheckbox
              v-model="profileForm.healthConsent"
              label="J’accepte que ces informations de santé soient transmises aux équipes d’organisation et de cuisine de mes jeux"
            />
          </UFormField>
          <div class="sm:col-span-2">
            <UButton type="submit" color="primary" :loading="saving === 'profile'">Enregistrer mes coordonnées</UButton>
          </div>
        </form>
        <p v-if="messages.profile" class="mt-2 text-sm text-green-700">{{ messages.profile }}</p>
      </UCard>

      <UCard>
        <template #header><h2 class="font-semibold">Stockage</h2></template>
        <p class="text-sm text-gray-600">
          {{ formatMb(account.storage.usedBytes) }} utilisés sur {{ formatMb(account.storage.quotaBytes) }}.
          Les photos et RIB de vos jeux comptent ici, même ceux ajoutés par vos co-organisatrices.
        </p>
        <UProgress class="mt-3" :model-value="storagePercent" :color="storagePercent >= 90 ? 'error' : 'primary'" />
      </UCard>
      <!-- Mes données (US-076, US-077) -->
      <UCard>
        <template #header><h2 class="font-semibold">Mes données</h2></template>
        <div class="space-y-4">
          <div>
            <UButton to="/api/account/export" external download="mes-donnees-limbus.json" color="neutral" variant="soft" icon="i-heroicons-arrow-down-tray">
              Télécharger mes données
            </UButton>
            <p class="mt-1 text-sm text-gray-500">Votre compte, vos coordonnées et tout ce que les équipes de vos jeux gardent sur vous, dans un fichier.</p>
          </div>
          <form class="space-y-2 border-t border-gray-100 pt-4" @submit.prevent="deleteAccount">
            <h3 class="font-medium text-red-700">Effacer mon compte</h3>
            <p class="text-sm text-gray-600">
              Effacement immédiat et définitif : votre compte, vos coordonnées et toutes vos fiches chez les équipes (inscriptions, photos, paiements).
              Chaque équipe est prévenue par email que vos places sont libérées. Si vous possédez des jeux, transférez-les ou supprimez-les d’abord.
            </p>
            <UFormField label="Mot de passe">
              <UInput v-model="deletePassword" type="password" required autocomplete="current-password" class="w-full sm:w-80" />
            </UFormField>
            <UButton type="submit" color="error" variant="soft" :loading="saving === 'delete'">Effacer mon compte</UButton>
          </form>
        </div>
      </UCard>
    </template>

    <UAlert v-if="error" color="error" variant="soft" :description="error" />
  </div>
</template>

<script setup>
// Mon compte (US-063, US-066)
import { formatMegabytes as formatMb } from '~/utils/fileSizes'
import { clearOfflineData } from '~/utils/storage'

const account = ref(null)
const loadError = ref('')
const error = ref('')
const saving = ref('')
const name = ref('')
const emailForm = ref({ email: '', password: '' })
const passwordForm = ref({ currentPassword: '', password: '' })
const profileForm = ref({ phone: '', emergencyContactName: '', emergencyContactPhone: '', dietary: '', healthConsent: false })
const messages = ref({ name: '', password: '', profile: '' })

const storagePercent = computed(() => {
  const storage = account.value?.storage
  return storage?.quotaBytes ? Math.min(100, Math.round(storage.usedBytes / storage.quotaBytes * 100)) : 0
})

async function load() {
  try {
    account.value = await useApiFetch('/api/account')
    name.value = account.value.name
    profileForm.value = { ...profileForm.value, ...Object.fromEntries(Object.entries(account.value.profile).filter(([key, value]) => key !== 'updatedAt' && value !== null)) }
  } catch (err) {
    loadError.value = err?.data?.message || 'Impossible de charger le compte.'
  }
}

async function run(key, action) {
  saving.value = key
  error.value = ''
  messages.value = { name: '', password: '', profile: '' }
  try {
    await action()
  } catch (err) {
    error.value = err?.data?.message || 'Erreur inconnue'
  } finally {
    saving.value = ''
  }
}

const saveName = () => run('name', async () => {
  await useApiFetch('/api/account', { method: 'PUT', body: { name: name.value } })
  messages.value.name = 'Nom enregistré.'
  await load()
})

const changeEmail = () => run('email', async () => {
  await useApiFetch('/api/account/email', { method: 'POST', body: emailForm.value })
  emailForm.value = { email: '', password: '' }
  await load()
})

const changePassword = () => run('password', async () => {
  await useApiFetch('/api/account/password', { method: 'PUT', body: passwordForm.value })
  passwordForm.value = { currentPassword: '', password: '' }
  messages.value.password = 'Mot de passe changé. Vos autres appareils sont déconnectés.'
})

const saveProfile = () => run('profile', async () => {
  await useApiFetch('/api/account/profile', { method: 'PUT', body: profileForm.value })
  messages.value.profile = 'Coordonnées enregistrées : vos fiches et inscriptions sont à jour.'
})

const deletePassword = ref('')
const deleteAccount = () => {
  if (!confirm('Effacer définitivement votre compte et toutes vos données ? Cette action ne peut pas être annulée.')) return
  return run('delete', async () => {
    await useApiFetch('/api/account/delete', { method: 'POST', body: { password: deletePassword.value } })
    // Compte effacé et cookie retiré : rien ne reste non plus sur l'appareil
    await clearOfflineData()
    window.location.replace('/')
  })
}

await load()
</script>
