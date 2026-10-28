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
          <UButton type="submit" color="primary" :disabled="!email || !confirmed || busy" :loading="sending">
            Léguer une copie
          </UButton>
        </form>

        <UAlert v-if="message" color="success" variant="soft" :description="message" />
        <UAlert v-if="errorMessage" color="error" variant="soft" :description="errorMessage" />

        <section v-if="pendingBequests.length" class="space-y-2 border-t border-gray-200 pt-4">
          <h3 class="font-semibold">Legs en attente</h3>
          <p class="text-sm text-gray-600">
            Ces personnes n’ont pas encore créé leur compte. Une copie annulée ou expirée est supprimée.
          </p>
          <ul class="divide-y divide-gray-200 text-sm">
            <li v-for="bequest in pendingBequests" :key="bequest.id" class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div class="font-medium">{{ bequest.email }}</div>
                <div class="text-gray-600">
                  Légué le {{ formatDate(bequest.createdAt) }}, expire le {{ formatDate(bequest.expiresAt) }}
                </div>
              </div>
              <div class="flex gap-2">
                <UButton size="xs" color="neutral" variant="soft" :loading="busyId === bequest.id" :disabled="busy" @click="resend(bequest)">
                  Renvoyer
                </UButton>
                <UButton size="xs" color="error" variant="soft" :disabled="busy" @click="cancel(bequest)">
                  Annuler
                </UButton>
              </div>
            </li>
          </ul>
        </section>
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
const pendingBequests = ref([])
const busyId = ref('')
// Une action à la fois : chacune efface les messages et recharge la liste
const busy = computed(() => sending.value || Boolean(busyId.value))

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long' })

watch(open, (value) => {
  if (!value) return
  email.value = ''
  confirmed.value = false
  message.value = ''
  errorMessage.value = ''
  loadPendingBequests()
})

// Legs à des personnes sans compte, pas encore attribués (US-012)
async function loadPendingBequests() {
  if (!props.game?.id) return
  try {
    pendingBequests.value = await useApiFetch(`/api/games/${props.game.id}/bequests`)
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Impossible de charger les legs en attente'
  }
}

async function resend(bequest) {
  if (busy.value) return
  busyId.value = bequest.id
  message.value = ''
  errorMessage.value = ''
  try {
    const result = await useApiFetch(`/api/games/${props.game.id}/bequests/${bequest.id}/resend`, { method: 'POST' })
    message.value = `Invitation renvoyée à ${bequest.email}, valable jusqu’au ${formatDate(result.expiresAt)}.`
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Impossible de renvoyer l’invitation'
  } finally {
    busyId.value = ''
    await loadPendingBequests()
  }
}

async function cancel(bequest) {
  if (busy.value || !confirm(`Annuler le legs à ${bequest.email} ? La copie sera supprimée, et le lien de son invitation ne fonctionnera plus.`)) return
  busyId.value = bequest.id
  message.value = ''
  errorMessage.value = ''
  try {
    await useApiFetch(`/api/games/${props.game.id}/bequests/${bequest.id}`, { method: 'DELETE' })
    message.value = `Legs à ${bequest.email} annulé : la copie est supprimée.`
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Impossible d’annuler le legs'
  } finally {
    busyId.value = ''
    await loadPendingBequests()
  }
}

async function bequeath() {
  if (!props.game?.id || !email.value || !confirmed.value || busy.value) return

  sending.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const result = await useApiFetch(`/api/games/${props.game.id}/bequests`, {
      method: 'POST',
      body: { email: email.value }
    })
    const recipient = result.recipient?.name || result.recipient?.email
    message.value = result.pending
      ? `${recipient} n’a pas encore de compte Limbus : elle a reçu une invitation à en créer un, valable jusqu’au ${new Date(result.expiresAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })}. La copie lui sera attribuée à la création de son compte.`
      : result.emailDelivery?.sent
      ? `Copie léguée à ${recipient}, qui a été prévenue par email.`
      : `Copie léguée à ${recipient}, mais l’email n’a pas pu être envoyé : prévenez-la vous-même.`
    email.value = ''
    confirmed.value = false
    if (result.pending) await loadPendingBequests()
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Impossible de léguer le jeu'
  } finally {
    sending.value = false
  }
}
</script>
