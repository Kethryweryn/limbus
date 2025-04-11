<template>
    <div v-if="game" class="mb-4 p-3 bg-gray-100 rounded-lg flex items-center justify-between">
        <div>
            <span class="font-medium">Jeu sélectionné :</span>
            <span class="ml-2">{{ game.title }}</span>
        </div>
        <UButton size="xs" color="gray" @click="clearGame">Changer de jeu</UButton>
    </div>
</template>

<script setup>
import { useGameFocus } from '@/composables/useGameFocus'

const { game, selectGame, gameStore } = useGameFocus()

function clearGame() {
    gameStore.clearGame()
}
</script>