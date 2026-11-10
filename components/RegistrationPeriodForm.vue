<template>
  <UModal v-model:open="open" :title="period?.id ? 'Réglages du vivier' : 'Créer le vivier'">
    <template #body>
      <form class="space-y-5" novalidate @submit.prevent="submit">
        <p v-if="!period?.id" class="text-sm text-gray-600">
          Un jeu a un seul vivier. Vous le préparez, puis vous l’ouvrez : son lien de diffusion marche alors, et il n’a pas de date de clôture.
        </p>
        <AppCheckboxRow
          v-model="form.notifyTeam"
          label="Me prévenir de chaque réponse au questionnaire"
          description="La propriétaire et les co-organisatrices reçoivent un email pour chaque réponse dont l’adresse est confirmée."
        />
        <!-- Rejoueurs (R24) : personnes qui ont déjà joué une session terminée du jeu -->
        <UFormField
          label="Personnes qui ont déjà joué le jeu"
          description="Signalées dans la sélection, ou exclues des demandes et du tirage ; on peut toujours les retenir à la main."
        >
          <USelect v-model="form.replayPolicy" :items="REPLAY_POLICY_ITEMS" value-key="value" class="w-full" />
        </UFormField>
        <UFormField label="Délai de réponse (jours)" description="Accordé à chaque personne invitée ou retenue." :error="errors.responseDelayDays">
          <UInput v-model.number="form.responseDelayDays" type="number" min="1" max="90" required class="w-full sm:w-40" />
        </UFormField>

        <UAlert
          v-if="serverError"
          color="error"
          variant="soft"
          :description="serverError"
        />

        <div class="flex flex-wrap gap-2">
          <UButton type="submit" color="primary" :loading="saving">
            {{ period?.id ? 'Enregistrer' : 'Créer' }}
          </UButton>
          <UButton type="button" color="neutral" variant="soft" @click="open = false">
            Annuler
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import {
  REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_REPLAY_POLICY_OPTIONS
} from '~/utils/domain'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'

const REPLAY_POLICY_ITEMS: Array<{ value: string, label: string }> = [...REGISTRATION_REPLAY_POLICY_OPTIONS]

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(defineProps<{
  gameId: string
  // Vivier à régler, ou null pour le créer
  period?: RegistrationPeriod | null
}>(), { period: null })

const emit = defineEmits<{ saved: [] }>()

const form = ref(formFrom(props.period))
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const saving = ref(false)

function formFrom(period: RegistrationPeriod | null) {
  return {
    notifyTeam: period?.notifyTeam ?? false,
    replayPolicy: (period?.replayPolicy ?? REGISTRATION_REPLAY_POLICIES.allowed) as string,
    // Un champ nombre vidé rend une chaîne vide : la validation le refuse
    responseDelayDays: (period?.responseDelayDays ?? REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS) as number | ''
  }
}

watch(open, (value) => {
  if (!value) return
  errors.value = {}
  serverError.value = ''
  form.value = formFrom(props.period)
})

function validate() {
  const delay = Number(form.value.responseDelayDays)
  errors.value = !Number.isInteger(delay) || delay < 1 || delay > 90 ? { responseDelayDays: 'Entre 1 et 90 jours.' } : {}
  return !Object.keys(errors.value).length
}

async function submit() {
  if (!validate()) return

  saving.value = true
  serverError.value = ''
  try {
    const body = { ...form.value, responseDelayDays: Number(form.value.responseDelayDays), gameId: props.gameId }
    if (props.period?.id) await useApiAction(`/api/registration-periods/${props.period.id}`, { method: 'PUT', body: { ...body, updatedAt: props.period.updatedAt } })
    else await useApiAction('/api/registration-periods', { method: 'POST', body })
    emit('saved')
    open.value = false
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Enregistrement impossible')
  } finally {
    saving.value = false
  }
}
</script>
