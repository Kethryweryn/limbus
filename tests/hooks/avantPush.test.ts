// ADR-0068 : le hook repère un `git push`, et laisse passer la documentation seule
import { describe, expect, it } from 'vitest'
import { isGitPush, needsChecks } from '../../.claude/hooks/avant-push.mjs'

describe('isGitPush', () => {
  it.each([
    'git push',
    'git push -u origin ma-branche',
    'cd projet && git push -q',
    'git add . ; git push 2>&1 | grep -v remote',
    'git -C projet push',
    'x=1\ngit push',
    'bash -c "git push"',
    "bash -c 'git push -q'"
  ])('repère %s', (command) => {
    expect(isGitPush(command)).toBe(true)
  })

  it.each([
    'git status',
    'git log --grep push',
    'echo pushed',
    'gh pr create --title "git pushes"',
    'git stash push'
  ])('ignore %s', (command) => {
    expect(isGitPush(command)).toBe(false)
  })
})

describe('needsChecks', () => {
  it('ne demande rien pour la documentation seule', () => {
    expect(needsChecks(['doc/README.md', 'CLAUDE.md', 'README.md'])).toBe(false)
    expect(needsChecks([])).toBe(false)
  })

  it('demande les vérifications dès qu’un fichier de code change', () => {
    expect(needsChecks(['doc/README.md', 'pages/index.vue'])).toBe(true)
    expect(needsChecks(['.claude/settings.json'])).toBe(true)
    expect(needsChecks(['nouveautes/note.md'])).toBe(true)
  })
})
