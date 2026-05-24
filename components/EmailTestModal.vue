<template>
  <UModal v-model:open="openProxy" title="Tester l'email">
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-5">
      <section class="space-y-4">
        <div class="space-y-2">
          <UCheckbox
            v-model="sendToMe"
            label="Moi"
            :disabled="!props.defaultEmail"
          />
          <UCheckbox
            v-model="sendToOrganizers"
            label="Équipe orga"
            :disabled="!organizerEmails.length"
          />
        </div>

        <UFormField label="Emails supplémentaires">
          <UTextarea
            v-model="emailsText"
            :rows="5"
            class="w-full"
            placeholder="adresse@example.com"
          />
        </UFormField>
        <p class="text-xs text-gray-500">
          Un email par ligne, ou plusieurs emails séparés par des virgules.
        </p>

        <div v-if="selectedEmails.length" class="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
          <div class="font-medium mb-2">Destinataires de test</div>
          <div class="flex flex-wrap gap-1">
            <UBadge v-for="email in selectedEmails" :key="email" color="neutral" variant="subtle" size="xs">
              {{ email }}
            </UBadge>
          </div>
        </div>

        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="openProxy = false">
            Annuler
          </UButton>
          <UButton color="neutral" variant="soft" :loading="loading" :disabled="loading || submitCooldown" @click="submit">
            Envoyer le test
          </UButton>
        </div>
      </section>

      <section class="rounded border border-gray-200 bg-white p-4 space-y-4">
        <div>
          <div class="text-xs uppercase text-gray-500">Sujet</div>
          <div class="font-medium">{{ preview.subject || 'Aucun sujet' }}</div>
        </div>
        <div>
          <div class="text-xs uppercase text-gray-500">Corps</div>
          <pre class="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm font-sans text-gray-700">{{ preview.body || 'Aucun contenu' }}</pre>
        </div>
        <div>
          <div class="text-xs uppercase text-gray-500">Pièces jointes / liens</div>
          <div v-if="preview.attachments?.length" class="mt-1 flex flex-wrap gap-1">
            <UBadge
              v-for="attachment in preview.attachments"
              :key="attachment"
              color="neutral"
              variant="subtle"
              size="xs"
            >
              {{ attachment }}
            </UBadge>
          </div>
          <div v-else class="mt-1 text-sm text-gray-500">Aucune</div>
        </div>
      </section>
    </div>
  </UModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  defaultEmail: { type: String, default: '' },
  organizerEmails: { type: Array, default: () => [] },
  preview: { type: Object, default: () => ({ subject: '', body: '', attachments: [] }) },
  onSubmit: { type: Function, required: true }
})

const emit = defineEmits(['update:open'])

const emailsText = ref('')
const sendToMe = ref(false)
const sendToOrganizers = ref(false)
const loading = ref(false)
const submitCooldown = ref(false)
const error = ref('')

const openProxy = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

watch(() => props.open, (value) => {
  if (value) {
    emailsText.value = ''
    sendToMe.value = Boolean(props.defaultEmail)
    sendToOrganizers.value = false
    submitCooldown.value = false
    error.value = ''
  }
})

function parseEmails() {
  return emailsText.value
    .split(/[\n,;]/)
    .map((email) => email.trim())
    .filter(Boolean)
}

const organizerEmails = computed(() =>
  [...new Set((props.organizerEmails || []).map((email) => String(email || '').trim()).filter(Boolean))]
)

const preview = computed(() => props.preview || { subject: '', body: '', attachments: [] })

const selectedEmails = computed(() => {
  const emails = [
    ...(sendToMe.value && props.defaultEmail ? [props.defaultEmail] : []),
    ...(sendToOrganizers.value ? organizerEmails.value : []),
    ...parseEmails()
  ]
  return [...new Set(emails)]
})

async function submit() {
  if (loading.value || submitCooldown.value) return

  const emails = selectedEmails.value
  if (!emails.length) {
    error.value = 'Ajoute au moins un email.'
    return
  }

  loading.value = true
  error.value = ''
  try {
    await props.onSubmit(emails)
    openProxy.value = false
  } catch (err) {
    error.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    loading.value = false
    submitCooldown.value = true
    window.setTimeout(() => {
      submitCooldown.value = false
    }, 1500)
  }
}
</script>
