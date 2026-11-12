// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      // Aucun `any` dans le dépôt, tests et scripts compris (fiche lint-sans-any)
      '@typescript-eslint/no-explicit-any': 'error',
      // Nom d'icône écrit en entier (US-250, ADR-0091) : un nom calculé n'est pas embarqué, et manque sans réseau
      'no-restricted-syntax': ['error',
        { selector: 'TemplateLiteral > TemplateElement:first-child[value.raw=/^i-[a-z]+-/]', message: 'Écrire le nom de l’icône en entier : un nom calculé n’est pas embarqué dans la page.' },
        { selector: 'BinaryExpression[operator="+"] > Literal.left[value=/^i-[a-z]+-/]', message: 'Écrire le nom de l’icône en entier : un nom calculé n’est pas embarqué dans la page.' }
      ]
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
