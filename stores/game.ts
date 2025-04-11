// stores/game.ts
import { defineStore } from 'pinia'

export const useGameStore = defineStore('game', {
    state: () => ({
        currentGame: null as null | { id: string; title: string }
    }),
    actions: {
        setGame(game) {
            this.currentGame = game
        },
        clearGame() {
            this.currentGame = null
        }
    },
    persist: true
})
