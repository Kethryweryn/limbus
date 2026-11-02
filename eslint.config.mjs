// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

// Interface passée en TypeScript strict (EPIC-031, ADR-0057) : la liste grandit à chaque lot, puis couvre tout
const TYPED_INTERFACE = [
  'app.vue',
  'components/AccessCard.vue',
  'components/AppCheckboxRow.vue',
  'components/AppWideSlideover.vue',
  'components/Character*.vue',
  'components/DocumentForm.vue',
  'components/FactionForm.vue',
  'components/Game*.vue',
  'components/IntrigueForm.vue',
  'components/ItemForm.vue',
  'components/LegalLinks.vue',
  'components/LegalPage.vue',
  'components/LocationForm.vue',
  'components/LoginScreen.vue',
  'components/OfflineQueuePanel.vue',
  'components/SidebarLink.vue',
  'components/SidebarSection.vue',
  'components/TermsAcceptanceScreen.vue',
  'components/Timeline*.vue',
  'components/UnconfirmedAccountScreen.vue',
  'composables/**/*.ts',
  'layouts/**/*.vue',
  'pages/acces/**/*.vue',
  'pages/characters/**/*.vue',
  'pages/conditions.vue',
  'pages/confidentialite.vue',
  'pages/documents/**/*.vue',
  'pages/factions/**/*.vue',
  'pages/games/**/*.vue',
  'pages/intrigues/**/*.vue',
  'pages/items/**/*.vue',
  'pages/locations/**/*.vue',
  'pages/logout.vue',
  'pages/mentions-legales.vue',
  'pages/timeline/**/*.vue',
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
