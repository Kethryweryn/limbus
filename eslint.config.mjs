// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      // Aucun `any` dans le dépôt, tests et scripts compris (fiche lint-sans-any)
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },
  {
    // Interface en TypeScript strict (EPIC-031, ADR-0057) : tout composant et toute page en <script lang="ts">
    files: ['**/*.vue'],
    rules: {
      'vue/block-lang': ['error', { script: { lang: 'ts' } }]
    }
  }
)
