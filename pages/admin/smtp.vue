<template>
  <div class="p-6 space-y-6">
    <div>
      <h1 class="text-2xl font-bold">SMTP</h1>
      <p class="text-sm text-gray-500">
        Configuration du serveur d’envoi d’emails de Limbus.
      </p>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">Serveur d’envoi</h2>
            <p class="text-sm text-gray-500">
              Utilisé pour les invitations et les futurs envois de documents.
            </p>
          </div>
          <UBadge :color="form.enabled ? 'success' : 'neutral'" variant="subtle">
            {{ form.enabled ? 'Activé' : 'Désactivé' }}
          </UBadge>
        </div>
      </template>

      <form class="space-y-5" @submit.prevent="saveSettings">
        <UCheckbox v-model="form.enabled" label="Activer l’envoi d’emails" />

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <UFormField label="Serveur SMTP">
            <UInput v-model="form.host" placeholder="smtp.exemple.fr" class="w-full" />
          </UFormField>
          <UFormField label="Port">
            <UInput v-model="form.port" type="number" min="1" max="65535" class="w-full" />
          </UFormField>
          <UFormField label="Sécurité">
            <USelect v-model="secureMode" :items="secureOptions" value-key="value" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UFormField label="Utilisateur SMTP">
            <UInput v-model="form.username" autocomplete="username" class="w-full" />
          </UFormField>
          <UFormField :label="settings?.hasPassword ? 'Nouveau mot de passe SMTP' : 'Mot de passe SMTP'">
            <UInput
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              :placeholder="settings?.hasPassword ? 'Laisser vide pour conserver le mot de passe actuel' : ''"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UFormField label="Email expéditeur">
            <UInput v-model="form.fromEmail" type="email" placeholder="contact@exemple.fr" class="w-full" />
          </UFormField>
          <UFormField label="Nom expéditeur">
            <UInput v-model="form.fromName" placeholder="Limbus" class="w-full" />
          </UFormField>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton type="submit" color="primary" :loading="saving">
            Enregistrer
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            :disabled="!settings?.hasPassword"
            @click="clearPassword"
          >
            Retirer le mot de passe
          </UButton>
        </div>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Tester l’envoi</h2>
      </template>

      <form class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end" @submit.prevent="sendTest">
        <UFormField label="Destinataire">
          <UInput v-model="testEmail" type="email" required class="w-full" />
        </UFormField>
        <UButton type="submit" color="primary" variant="soft" :loading="testing">
          Envoyer un test
        </UButton>
      </form>
    </UCard>

    <UAlert
      v-if="message"
      color="success"
      variant="soft"
      :description="message"
    />
    <UAlert
      v-if="serverError"
      color="error"
      variant="soft"
      :description="serverError"
    />
  </div>
</template>

<script setup>
const secureOptions = [
  { label: 'STARTTLS ou non sécurisé (ports 587/25)', value: 'starttls' },
  { label: 'TLS direct (port 465)', value: 'tls' }
]

const settings = ref(null)
const saving = ref(false)
const testing = ref(false)
const message = ref('')
const serverError = ref('')
const testEmail = ref('')

const form = ref({
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  username: '',
  password: '',
  fromEmail: '',
  fromName: 'Limbus'
})

const secureMode = computed({
  get: () => form.value.secure ? 'tls' : 'starttls',
  set: (value) => {
    form.value.secure = value === 'tls'
    form.value.port = value === 'tls' ? 465 : 587
  }
})

async function fetchSettings() {
  settings.value = await useApiFetch('/api/admin/smtp')
  if (!settings.value) return

  form.value = {
    enabled: settings.value.enabled,
    host: settings.value.host || '',
    port: settings.value.port || 587,
    secure: settings.value.secure,
    username: settings.value.username || '',
    password: '',
    fromEmail: settings.value.fromEmail || '',
    fromName: settings.value.fromName || 'Limbus'
  }
}

async function saveSettings() {
  saving.value = true
  serverError.value = ''
  message.value = ''

  try {
    settings.value = await useApiFetch('/api/admin/smtp', {
      method: 'PUT',
      body: {
        ...form.value,
        port: Number(form.value.port),
        password: form.value.password === null ? null : form.value.password || undefined
      }
    })
    form.value.password = ''
    message.value = 'Configuration SMTP enregistrée.'
  } catch (err) {
    serverError.value = err?.data?.message || err?.statusMessage || err?.message || 'Impossible d’enregistrer la configuration SMTP'
  } finally {
    saving.value = false
  }
}

async function clearPassword() {
  if (!confirm('Retirer le mot de passe SMTP enregistré ?')) return

  form.value.password = null
  await saveSettings()
}

async function sendTest() {
  testing.value = true
  serverError.value = ''
  message.value = ''

  try {
    await useApiFetch('/api/admin/smtp/test', {
      method: 'POST',
      body: { to: testEmail.value }
    })
    message.value = `Email de test envoyé à ${testEmail.value}.`
  } catch (err) {
    serverError.value = err?.data?.message || err?.statusMessage || err?.message || 'Impossible d’envoyer l’email de test'
  } finally {
    testing.value = false
  }
}

await fetchSettings()
</script>
