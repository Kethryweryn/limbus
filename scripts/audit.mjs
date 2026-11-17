// Audit des dépendances de la CI (ADR-0094) : `npm audit` refuse tout avis grave ou critique, sauf ceux exemptés ici,
// chacun avec sa raison. Une exemption devenue inutile (l'avis a disparu de l'audit) fait aussi échouer : on la retire.
import { execSync } from 'node:child_process'

const EXEMPTIONS = {
  // ReDoS par un motif de fichiers piégé, aucune version corrigée (2026-11-17). picomatch n'est pas dans le serveur en
  // service (.output/server) : seulement dans les outils de build, avec des motifs écrits dans leur configuration
  'https://github.com/advisories/GHSA-fc5q-39xc-vjpf': 'picomatch, outils de build seulement'
}

const BLOCKING = new Set(['high', 'critical'])

let output
try {
  output = execSync('npm audit --json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
} catch (error) {
  // npm audit sort en erreur dès qu'il trouve un avis : son rapport est sur la sortie standard
  output = error.stdout
}
const report = JSON.parse(output)
if (report.error) throw new Error(`npm audit : ${report.error.summary ?? JSON.stringify(report.error)}`)

const advisories = new Map()
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via === 'object') advisories.set(via.url, via)
  }
}

const blocking = [...advisories.values()].filter((advisory) => BLOCKING.has(advisory.severity) && !(advisory.url in EXEMPTIONS))
const stale = Object.keys(EXEMPTIONS).filter((url) => !advisories.has(url))

for (const url of Object.keys(EXEMPTIONS)) {
  if (advisories.has(url)) console.log(`Exempté : ${url} (${EXEMPTIONS[url]})`)
}
for (const advisory of blocking) console.error(`Avis ${advisory.severity} : ${advisory.name} ${advisory.range} — ${advisory.title} ${advisory.url}`)
for (const url of stale) console.error(`Exemption devenue inutile, à retirer de scripts/audit.mjs : ${url}`)

if (blocking.length || stale.length) process.exit(1)
console.log(`Aucun avis grave ou critique hors exemption (${advisories.size} avis au total).`)
