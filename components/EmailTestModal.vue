<template>
  <UModal v-model:open="openProxy" title="Tester l'email">
    <div class="space-y-4">
      <UFormField label="Emails de test">
        <UTextarea
          v-model="emailsText"
          :rows="4"
          class="w-full"
          placeholder="adresse@example.com"
        />
      </UFormField>
      <p class="text-xs text-gray-500">
        Un email par ligne, ou plusieurs emails séparés par des virgules.
      </p>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="openProxy = false">
          Annuler
        </UButton>
        <UButton color="neutral" variant="soft" :loading="loading" @click="submit">
          Envoyer le test
        </UButton>
      </div>
    </div>
  </UModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  defaultEmail: { type: String, default: '' },
  onSubmit: { type: Function, required: true }
})

const emit = defineEmits(['update:open'])

const emailsText = ref('')
const loading = ref(false)
const error = ref('')

const openProxy = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

watch(() => props.open, (value) => {
  if (value) {
    emailsText.value = props.defaultEmail || ''
    error.value = ''
  }
})

function parseEmails() {
  return emailsText.value
    .split(/[\n,;]/)
    .map((email) => email.trim())
    .filter(Boolean)
}

async function submit() {
  const emails = parseEmails()
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
  }
}
</script>
