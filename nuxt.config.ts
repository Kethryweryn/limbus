// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync } from 'fs'
export default defineNuxtConfig({
  compatibilityDate: '2025-04-07',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  devServer: {
    host: '0.0.0.0',
    port: 3000,
    https: {
      key: readFileSync('./certs/key.pem'),
      cert: readFileSync('./certs/cert.pem')
    }
  },
  serverMiddleware: [
    '~/server/middleware/ignore-bots.ts'
  ],
})