// composables/useGameFocus.ts
import { useGameStore } from '@/stores/game'

export function useGameFocus() {
    const gameStore = useGameStore()

    function selectGame(game) {
        gameStore.setGame(game)
    }

    return {
        game: gameStore.currentGame,
        selectGame
    }
}
