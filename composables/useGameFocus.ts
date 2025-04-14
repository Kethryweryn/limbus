import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

export function useGameFocus() {
    const store = useGameStore()

    return {
        game: computed(() => store.currentGame),  // ✅ Réactif
        selectGame: store.setGame,
        clearGame: store.clearGame
    }
}
