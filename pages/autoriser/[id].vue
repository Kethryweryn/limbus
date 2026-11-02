<template>
  <div class="mx-auto max-w-2xl space-y-4 p-6">
    <h1 class="text-2xl font-bold">Autoriser un assistant d’IA</h1>

    <UAlert v-if="loadError" color="error" variant="soft" :description="loadError" />

    <UCard v-else-if="request">
      <div class="space-y-5">
        <div class="space-y-1">
          <p>
            <strong>{{ request.client.name }}</strong> demande à accéder à des jeux de Limbus en votre nom.
          </p>
          <p class="text-sm text-gray-500">
            L’accès sera renvoyé à <strong>{{ request.redirectHost }}</strong>.
          </p>
          <UAlert
            v-if="request.loopbackOnly"
            color="warning"
            variant="soft"
            description="Cette adresse est sur votre appareil : n’importe quel programme qui y tourne pourrait la prendre. N’autorisez que si vous venez de lancer cet assistant vous-même."
          />
        </div>

        <fieldset class="space-y-2">
          <legend class="font-medium">Droits</legend>
          <URadioGroup v-model="access" :items="accessItems" />
        </fieldset>

        <fieldset class="space-y-2">
          <legend class="font-medium">Jeux accessibles</legend>
          <p v-if="!request.games.length" class="text-sm text-gray-500">
            Aucun jeu à ouvrir : l’assistant ne verra rien tant que vous n’en cochez pas un depuis votre compte.
          </p>
          <UCheckbox
            v-for="game in request.games"
            :key="game.id"
            :model-value="gameIds.includes(game.id)"
            :label="game.owned ? game.title : `${game.title} (partagé avec vous)`"
            @update:model-value="toggleGame(game.id, $event === true)"
          />
        </fieldset>

        <p class="text-sm text-gray-500">
          L’assistant ne voit jamais les coordonnées, les allergies ni les réponses libres des participants, et n’envoie aucun email.
          Son fournisseur reçoit ce que vous lui ouvrez : vous en êtes responsable vis-à-vis de vos joueurs.
          Vous pourrez retirer cet accès à tout moment dans votre compte.
        </p>

        <UAlert v-if="error" color="error" variant="soft" :description="error" />

        <div class="flex flex-wrap gap-2">
          <UButton color="primary" :loading="deciding === 'allow'" :disabled="Boolean(deciding)" @click="decide(true)">
            Autoriser
          </UButton>
          <UButton color="neutral" variant="soft" :loading="deciding === 'deny'" :disabled="Boolean(deciding)" @click="decide(false)">
            Refuser
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
// Page « Autoriser » d'un assistant d'IA (US-121, SPEC-014 R2, R4, R5)
import { serverMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

const route = useRoute()
const id = String(route.params.id)

const request = ref<ApiResponse<'/api/oauth/requests/:id'> | null>(null)
const loadError = ref('')
const error = ref('')
const access = ref<'read' | 'write'>('read')
const gameIds = ref<string[]>([])
const deciding = ref<'' | 'allow' | 'deny'>('')

const accessItems = [
  { label: 'Lecture seule', value: 'read', description: 'L’assistant lit les jeux cochés.' },
  { label: 'Lecture et écriture', value: 'write', description: 'Il peut aussi modifier le contenu des jeux cochés, sans rien envoyer, publier ni supprimer de jeu ou de session.' }
]

function toggleGame(gameId: string, checked: boolean) {
  gameIds.value = checked ? [...gameIds.value, gameId] : gameIds.value.filter((value) => value !== gameId)
}

onMounted(async () => {
  try {
    request.value = await useApiFetch(`/api/oauth/requests/${id}`)
  } catch (err) {
    loadError.value = serverMessage(err, 'Demande introuvable : relancez la connexion depuis votre assistant.')
  }
})

async function decide(allow: boolean) {
  deciding.value = allow ? 'allow' : 'deny'
  error.value = ''
  try {
    const { redirectUrl } = await useApiAction(`/api/oauth/requests/${id}/decision`, {
      method: 'POST',
      body: { allow, canWrite: access.value === 'write', gameIds: gameIds.value }
    })
    window.location.assign(redirectUrl)
  } catch (err) {
    error.value = serverMessage(err, 'Décision impossible')
    deciding.value = ''
  }
}
</script>
