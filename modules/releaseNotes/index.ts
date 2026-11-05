// Met les notes et le numéro de déploiement à disposition de la page « Nouveautés » (ADR-0065)
import { addTemplate, defineNuxtModule } from 'nuxt/kit'
import { buildReleaseNotes } from './notes'

export default defineNuxtModule({
  meta: { name: 'release-notes' },
  setup(_options, nuxt) {
    addTemplate({
      filename: 'release-notes.json',
      write: true,
      getContents: () => JSON.stringify(buildReleaseNotes({
        rootDir: nuxt.options.rootDir,
        repo: process.env.NOUVEAUTES_DEPOT,
        prNumber: process.env.NOUVEAUTES_PR
      }))
    })
  }
})
