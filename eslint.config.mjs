// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

// Interface passée en TypeScript strict (EPIC-031, ADR-0057) : la liste grandit à chaque lot, puis couvre tout
const TYPED_INTERFACE = [
  'app.vue',
  'layouts/**/*.vue',
  'composables/**/*.ts',
  'components/AccessCard.vue',
  'components/AppCheckboxRow.vue',
  'components/AppWideSlideover.vue',
  'components/GameContextBar.vue',
  'components/LegalLinks.vue',
  'components/LegalPage.vue',
  'components/LoginScreen.vue',
  'components/OfflineQueuePanel.vue',
  'components/SidebarLink.vue',
  'components/SidebarSection.vue',
  'components/TermsAcceptanceScreen.vue',
  'components/UnconfirmedAccountScreen.vue',
  'pages/acces/**/*.vue',
  'pages/conditions.vue',
  'pages/confidentialite.vue',
  'pages/logout.vue',
  'pages/mentions-legales.vue'
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
