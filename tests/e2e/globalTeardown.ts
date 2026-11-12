import { createTestPrisma } from '../integration/db'

// Garde-fou de la CSP (US-250, ADR-0091) : la suite ouvre tous les écrans avec la CSP de la production, et le navigateur
// signale chaque violation à /api/public/csp-report, qui la compte en base. Une seule violation fait échouer la suite :
// une ressource que la CSP refuserait casserait cet écran une fois la CSP bloquante
export default async function globalTeardown() {
  const prisma = createTestPrisma()
  try {
    const violations = await prisma.cspViolation.findMany({
      select: { directive: true, blockedUri: true, documentPath: true, count: true },
      orderBy: { documentPath: 'asc' }
    })
    if (violations.length) {
      const lines = violations.map((v) => `- ${v.directive} refuse ${v.blockedUri} sur ${v.documentPath} (${v.count} fois)`)
      throw new Error(`La CSP refuserait des ressources pendant les tests :\n${lines.join('\n')}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}
