<template>
  <UModal v-model:open="open" :title="`Prévenir l'équipe - ${session?.label || 'Session'}`">
    <template #body>
      <form class="space-y-4" @submit.prevent="send">
        <p class="text-sm text-gray-600">
          La session est annulée. Relisez l’email, modifiez-le si besoin : il partira à toutes les personnes de l’équipe
          qui ont une adresse email. Vous pouvez aussi fermer sans rien envoyer.
        </p>

        <UFormField label="Objet" required>
          <UInput v-model="form.subject" required class="w-full" />
        </UFormField>

        <UFormField label="Message" required>
          <UTextarea v-model="form.text" :rows="10" required class="w-full" />
        </UFormField>

        <p v-if="message" class="text-sm text-gray-700">{{ message }}</p>
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

        <div class="flex flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Fermer</UButton>
          <UButton
            v-if="defaultEmail"
            color="neutral"
            variant="soft"
            :loading="testing"
            :disabled="testing || sending || !ready"
            @click="sendTest"
          >
            M’envoyer un test
          </UButton>
          <UButton type="submit" color="primary" :loading="sending" :disabled="sending || testing || !ready">
            Envoyer à l’équipe
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { cancellationEmailDefaults } from '~/utils/sessionCancellation'
import { apiErrorMessage } from '~/utils/apiErrors'

// Email d'annulation proposé, relu et envoyé à la main (US-025)
const props = withDefaults(defineProps<{
  session?: { id: string, label: string, date?: string | null, game?: { title: string } | null } | null
  defaultEmail?: string
}>(), { session: null, defaultEmail: '' })
const open = defineModel<boolean>('open', { default: false })

const form = ref({ subject: '', text: '' })
const sending = ref(false)
const testing = ref(false)
const message = ref('')
const error = ref('')
const ready = computed(() => Boolean(form.value.subject.trim() && form.value.text.trim()))

watch(open, (value) => {
  if (!value || !props.session) return
  form.value = cancellationEmailDefaults({
    gameTitle: props.session.game?.title || 'Jeu',
    sessionLabel: props.session.label,
    sessionDate: props.session.date ?? null
  })
  message.value = ''
  error.value = ''
})

async function sendTest() {
  if (!props.session) return
  testing.value = true
  error.value = ''
  try {
    await useApiAction(`/api/sessions/${props.session.id}/cancellation-email/test`, {
      method: 'POST',
      body: { ...form.value, emails: [props.defaultEmail] }
    })
    message.value = `Test envoyé à ${props.defaultEmail}.`
  } catch (err) {
    error.value = apiErrorMessage(err, 'Le test n’est pas parti')
  } finally {
    testing.value = false
  }
}

async function send() {
  if (!props.session || !confirm('Envoyer l’email d’annulation à toute l’équipe ?')) return
  sending.value = true
  error.value = ''
  try {
    const result = await useApiAction(`/api/sessions/${props.session.id}/cancellation-email`, { method: 'POST', body: form.value })
    message.value = [
      `${result.sentCount} email(s) envoyé(s).`,
      result.withoutEmail.length ? `Sans email : ${result.withoutEmail.join(', ')}.` : '',
      result.failures.length ? `Non envoyés : ${result.failures.join(', ')}.` : ''
    ].filter(Boolean).join(' ')
  } catch (err) {
    error.value = apiErrorMessage(err, 'L’email n’est pas parti')
  } finally {
    sending.value = false
  }
}
</script>
