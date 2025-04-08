import type { Config } from 'tailwindcss'

export default {
  content: [],
  theme: {
    extend: {
      aspectRatio: {
        auto: 'auto',
        square: '1 / 1',
        video: '16 / 9'
      }
    },
  },
  plugins: [],
} satisfies Config
