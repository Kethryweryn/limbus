<template>
  <UModal v-model:open="open" :title="`Léguer une copie - ${game?.title || 'Jeu'}`">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-600">
          La destinataire reçoit une copie indépendante de ce jeu, dont elle devient propriétaire.
          Votre jeu n’est pas modifié, et vous n’aurez pas accès à la copie.
        </p>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
          <div class="rounded border border-gray-200 p-3">
            <h3 class="mb-1 font-semibold">Copié</h3>
            <ul class="list-disc space-y-0.5 pl-5 text-gray-600">
              <li>La fiche du jeu</li>
              <li>Personnages, factions, intrigues, objets, chronologie, documents et lieux, avec leurs liens</li>
              <li>Les réglages et photos du trombinoscope</li>
              <li>Le formulaire d’inscription</li>
            </ul>
          </div>
          <div class="rounded border border-gray-200 p-3">
            <h3 class="mb-1 font-semibold">Non copié</h3>
            <ul class="list-disc space-y-0.5 pl-5 text-gray-600">
              <li>Les sessions, leur cast, paiements et envois</li>
              <li>Les participants</li>
              <li>Les co-organisateurs et invitations</li>
              <li>Les périodes d’inscription et les inscriptions</li>
            </ul>
          </div>
        </div>

        <p class="text-sm text-gray-600">
          La copie affichera : « D’après « {{ game?.title }} », de {{ ownerName }} ».
        </p>

        <form class="space-y-3" @submit.prevent="bequeath">
          <UFormField label="Email de la destinataire" required>
            <UInput
              v-model="email"
              type="email"
              placeholder="email@exemple.fr"
              class="w-full"
              required
            />
          </UFormField>
          <AppCheckboxRow v-model="confirmed" label="Je confirme vouloir léguer une copie de ce jeu à cette personne." />
          <UButton type="submit" color="primary" :disabled="!email || !confirmed" :loading="sending">
            Léguer une copie
          </UButton>
        </form>

        <UAlert v-if="message" color="success" variant="soft" :description="message" />
        <UAlert v-if="errorMessage" color="error" variant="soft" :description="errorMessage" />
      </div>
    </template>
  </UModal>
</template>

<script setup>
const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  game: {
    type: Object,
    default: null
  },
  ownerName: {
    type: String,
    default: ''
  }
})

const email = ref('')
const confirmed = ref(false)
const sending = ref(false)
const message = ref('')
const errorMessage = ref('')

watch(open, (value) => {
  if (!value) return
  email.value = ''
  confirmed.value = false
  message.value = ''
  errorMessage.value = ''
})

async function bequeath() {
  if (!props.game?.id || !email.value || !confirmed.value) return

  sending.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const result = await useApiFetch(`/api/games/${props.game.id}/bequests`, {
      method: 'POST',
      body: { email: email.value }
    })
    const recipient = result.recipient?.name || result.recipient?.email
    message.value = result.emailDelivery?.sent
      ? `Copie léguée à ${recipient}, qui a été prévenue par email.`
      : `Copie léguée à ${recipient}, mais l’email n’a pas pu être envoyé : prévenez-la vous-même.`
    email.value = ''
    confirmed.value = false
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Impossible de léguer le jeu'
  } finally {
    sending.value = false
  }
}
</script>
