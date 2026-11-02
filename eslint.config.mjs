// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

// Interface passée en TypeScript strict (EPIC-031, ADR-0057) : tous les .vue, plus les composables et les utilitaires déjà convertis
const TYPED_INTERFACE = [
  '**/*.vue',
  'composables/**/*.ts',
  'utils/dates.ts',
  'utils/registrations.ts',
  'utils/sessionOffline.ts',
  'utils/sessions.ts',
  'utils/timeline.ts',
  'utils/writingDrafts.ts'
]

export default withNuxt(
  {
    rules: {
      // Beaucoup de `any` hérités : signalés sans bloquer la CI, à réduire au fil de l'eau
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  {
    files: TYPED_INTERFACE,
    rules: {
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
)
