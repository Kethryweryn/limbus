// Avant un `git push` de code : lint, typecheck et tests unitaires doivent passer (ADR-0067, ADR-0068).
// Hook PreToolUse : le code de sortie 2 refuse la commande, et stderr dit pourquoi à Claude.
import { execSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const CHECKS = ['npm run lint', 'npm run typecheck', 'npm test']
const TAIL_LINES = 40
// Les vérifications tournent à la racine du projet, quel que soit le dossier courant de la session
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()

export function isGitPush(command) {
  return /(^|[;&|\n("']\s*|\s)git(\s+-\S+(\s+\S+)?)*\s+push(\s|["']|$)/.test(command)
}

// Comme la CI (ADR-0022) : `doc/` et les `*.md` de la racine ne demandent aucune vérification de code
export function needsChecks(files) {
  return files.some((file) => !file.startsWith('doc/') && !/^[^/]+\.md$/.test(file))
}

function changedFiles() {
  try {
    const output = execSync('git diff --name-only origin/main...HEAD', { cwd: PROJECT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return output.split('\n').map((line) => line.trim()).filter(Boolean)
  } catch {
    // Comparaison impossible : on vérifie plutôt que de laisser passer
    return ['inconnu']
  }
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'))
  if (!isGitPush(input.tool_input?.command ?? '')) return 0
  if (!needsChecks(changedFiles())) return 0

  for (const check of CHECKS) {
    const run = spawnSync(check, { cwd: PROJECT_DIR, shell: true, encoding: 'utf8' })
    if (run.status !== 0) {
      const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim().split('\n').slice(-TAIL_LINES).join('\n')
      process.stderr.write(`Push refusé : « ${check} » échoue.\n${output}\n`)
      return 2
    }
  }
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
