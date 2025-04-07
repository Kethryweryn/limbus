// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-04-07',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },
  serverMiddleware: [
    '~/server/middleware/ignore-bots.ts'
  ],
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://localhost:3000', // proxy API si besoin localement
      }
    }
  }
})