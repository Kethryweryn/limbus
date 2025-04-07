// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-04-07',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  devServer: {
    host: '0.0.0.0',
    port: 3000,
    https: false, // on laisse Apache gérer le HTTPS
  },
  serverMiddleware: [
    '~/server/middleware/ignore-bots.ts'
  ],
  vite: {
    server: {
      hmr: {
        protocol: 'wss',
        host: 'limbus.jdmottot.fr',
        port: 443,
      }
    }
  }
})