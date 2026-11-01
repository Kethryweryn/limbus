import { describe, expect, it } from 'vitest'
import { balanceReserves, computeDraw, type DrawCandidate } from '~/utils/registrationDraw'

const people = (count: number, extra: Partial<DrawCandidate> = {}) =>
  Array.from({ length: count }, (_, index) => ({ registrationId: `r${String(index).padStart(2, '0')}`, weight: 1, preference: null, ...extra }))

describe('computeDraw (US-093, R18)', () => {
  it('la même graine et les mêmes entrées donnent le même résultat, dans n’importe quel ordre d’entrée', async () => {
    const candidates = people(10)
    const first = await computeDraw('graine', [{ sessionId: 's1', freeSeats: 3, reserves: null, candidates }], 2)
    const again = await computeDraw('graine', [{ sessionId: 's1', freeSeats: 3, reserves: null, candidates: [...candidates].reverse() }], 2)
    expect(again).toEqual(first)
    const other = await computeDraw('autre graine', [{ sessionId: 's1', freeSeats: 3, reserves: null, candidates }], 2)
    expect(other.sessions[0]!.order).not.toEqual(first.sessions[0]!.order)
  })

  it('retient dans la limite des places, met en attente les suivantes, et écarte le reste', async () => {
    const result = await computeDraw('g', [{ sessionId: 's1', freeSeats: 3, reserves: null, candidates: people(8) }], 2)
    const [session] = result.sessions
    expect(session!.retained).toHaveLength(3)
    expect(session!.waitlisted).toEqual(session!.order.slice(3, 5).map((item) => item.registrationId))
    expect(result.rejected).toHaveLength(3)
  })

  it('va session par session : une personne placée ne l’est pas deux fois', async () => {
    const candidates = people(4)
    const result = await computeDraw('g', [
      { sessionId: 's1', freeSeats: 2, reserves: null, candidates },
      { sessionId: 's2', freeSeats: 2, reserves: null, candidates }
    ], 5)
    const retained = result.sessions.flatMap((session) => session.retained)
    expect(new Set(retained).size).toBe(4)
    expect(result.sessions[1]!.order).toHaveLength(2)
    expect(result.rejected).toEqual([])
  })

  it('un poids 2 double à peu près les chances d’être tirée (R17)', async () => {
    let favouredWins = 0
    const runs = 2000
    for (let run = 0; run < runs; run++) {
      const result = await computeDraw(`g${run}`, [{
        sessionId: 's1',
        freeSeats: 1,
        reserves: null,
        candidates: [{ registrationId: 'a', weight: 2, preference: null }, { registrationId: 'b', weight: 1, preference: null }]
      }], 0)
      if (result.sessions[0]!.retained[0] === 'a') favouredWins++
    }
    // Deux chances sur trois
    expect(favouredWins / runs).toBeGreaterThan(0.62)
    expect(favouredWins / runs).toBeLessThan(0.71)
  })

  it('équilibre : chacune prend une place de sa valeur ; une valeur sans candidates laisse ses places libres', async () => {
    const candidates = [
      ...people(5, { preference: 'F' }),
      { registrationId: 'h1', weight: 1, preference: 'H' }
    ]
    const result = await computeDraw('g', [{ sessionId: 's1', freeSeats: 4, reserves: { F: 2, H: 2 }, candidates }], 10)
    const retained = result.sessions[0]!.retained
    expect(retained.filter((id) => id.startsWith('r'))).toHaveLength(2)
    expect(retained).toContain('h1')
    // Une place H reste libre
    expect(retained).toHaveLength(3)
  })

  it('« peu importe » prend une place dans la valeur la plus libre', async () => {
    const result = await computeDraw('g', [{
      sessionId: 's1',
      freeSeats: 3,
      reserves: { F: 1, H: 2 },
      candidates: [
        { registrationId: 'a', weight: 1, preference: null },
        { registrationId: 'b', weight: 1, preference: null },
        { registrationId: 'c', weight: 1, preference: 'H' }
      ]
    }], 0)
    expect(result.sessions[0]!.retained.sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('balanceReserves (R17)', () => {
  it('répartit les places au prorata des PJ, par les plus forts restes', () => {
    expect(balanceReserves(10, { F: 6, H: 4 }, [])).toEqual({ F: 6, H: 4 })
    expect(balanceReserves(5, { F: 6, H: 4 }, [])).toEqual({ F: 3, H: 2 })
    expect(balanceReserves(4, { A: 1, B: 1, C: 1 }, [])).toEqual({ A: 2, B: 1, C: 1 })
  })

  it('retire les places déjà prises, « peu importe » sur la valeur la plus libre', () => {
    expect(balanceReserves(10, { F: 6, H: 4 }, ['F', 'F', null])).toEqual({ F: 3, H: 4 })
  })

  it('sans PJ qui porte une valeur, pas d’équilibre', () => {
    expect(balanceReserves(10, {}, [])).toBeNull()
  })
})
