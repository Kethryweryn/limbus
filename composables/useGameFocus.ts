// composables/useGameFocus.ts
import { useGameStore } from '@/stores/game'

export function useGameFocus() {
    const gameStore = useGameStore()

    function selectGame(game) {
        gameStore.setGame(game)
    }

    function clearGame() {
        gameStore.clearGame()
    }

    return {
        game: gameStore.currentGame,
        selectGame,
        clearGame
    }
}
