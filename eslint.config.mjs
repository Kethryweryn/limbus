// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      // Beaucoup de `any` hérités : signalés sans bloquer la CI, à réduire au fil de l'eau
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
)
