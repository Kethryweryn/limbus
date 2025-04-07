// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  nitro: {
    devProxy: false,
    preset: 'node-server' // 👈 force l'utilisation du serveur Node natif
  },
  compatibilityDate: '2025-04-07',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },
  serverMiddleware: [
    '~/server/middleware/auth-global.server.ts',
    '~/server/middleware/ignore-bots.ts'
  ],
})