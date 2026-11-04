// Fonctions statistiques des repères du questionnaire (ADR-0061, ADR-0063), vérifiées contre SciPy dans les tests

const Z_95 = 1.959963984540054

// Logarithme de la fonction gamma (approximation de Lanczos, g = 7)
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  const shifted = x - 1
  const t = shifted + 7.5
  const series = LANCZOS.slice(1).reduce((sum, coefficient, index) => sum + coefficient / (shifted + index + 1), LANCZOS[0]!)
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series)
}

const GAMMA_ITERATIONS = 500
const GAMMA_EPSILON = 1e-14

/** Fonction gamma incomplète régularisée supérieure Q(a, x) : série sous a + 1, fraction continue au-delà. */
function upperGamma(a: number, x: number) {
  if (x <= 0) return 1
  const front = Math.exp(a * Math.log(x) - x - logGamma(a))
  if (x < a + 1) {
    let term = 1 / a
    let sum = term
    for (let n = 1; n < GAMMA_ITERATIONS && Math.abs(term) > Math.abs(sum) * GAMMA_EPSILON; n++) {
      term *= x / (a + n)
      sum += term
    }
    return Math.max(0, 1 - sum * front)
  }
  // Fraction continue de Lentz
  const tiny = 1e-300
  let b = x + 1 - a
  let c = 1 / tiny
  let d = 1 / b
  let h = d
  for (let n = 1; n < GAMMA_ITERATIONS; n++) {
    const an = -n * (n - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < tiny) d = tiny
    c = b + an / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < GAMMA_EPSILON) break
  }
  return Math.min(1, front * h)
}

/** P(Z ≥ z) pour la loi normale centrée réduite. */
export function normalSurvival(z: number) {
  const tail = 0.5 * upperGamma(0.5, z * z / 2)
  return z >= 0 ? tail : 1 - tail
}

/** P(X ≥ x) pour un khi-deux à df degrés de liberté. */
export function chiSquareSurvival(x: number, df: number) {
  return upperGamma(df / 2, x / 2)
}

/** P(X ≥ x) pour un khi-deux non central : mélange de lois centrales, aux poids de Poisson de moyenne λ/2. */
export function noncentralChiSquareSurvival(x: number, df: number, lambda: number) {
  if (lambda <= 0) return chiSquareSurvival(x, df)
  const mean = lambda / 2
  const last = Math.ceil(mean + 12 * Math.sqrt(mean) + 30)
  let sum = 0
  for (let j = 0; j <= last; j++) {
    const weight = Math.exp(j * Math.log(mean) - mean - logGamma(j + 1))
    sum += weight * chiSquareSurvival(x, df + 2 * j)
  }
  return Math.min(1, sum)
}

/** Intervalle de Wilson à 95 % d'une proportion (Wilson, 1927). */
export function wilsonInterval(count: number, total: number) {
  if (!total) return { lower: 0, upper: 1 }
  const share = count / total
  const z2 = Z_95 * Z_95
  const denominator = 1 + z2 / total
  const center = (share + z2 / (2 * total)) / denominator
  const margin = (Z_95 / denominator) * Math.sqrt(share * (1 - share) / total + z2 / (4 * total * total))
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) }
}

/** Valeurs p ajustées par la méthode de Holm (1979), dans l'ordre des valeurs reçues. */
export function holmAdjust(pValues: number[]) {
  const order = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p)
  const adjusted = new Array<number>(pValues.length)
  let running = 0
  order.forEach(({ p, index }, rank) => {
    running = Math.max(running, Math.min(1, (pValues.length - rank) * p))
    adjusted[index] = running
  })
  return adjusted
}

/** Corrélation de Pearson ; null si une variable est constante ou si les séries ont moins de 2 valeurs. */
export function pearson(a: number[], b: number[]) {
  const n = a.length
  if (n < 2) return null
  const meanA = a.reduce((sum, value) => sum + value, 0) / n
  const meanB = b.reduce((sum, value) => sum + value, 0) / n
  let covariance = 0
  let varianceA = 0
  let varianceB = 0
  for (let i = 0; i < n; i++) {
    const deltaA = a[i]! - meanA
    const deltaB = b[i]! - meanB
    covariance += deltaA * deltaB
    varianceA += deltaA * deltaA
    varianceB += deltaB * deltaB
  }
  if (!varianceA || !varianceB) return null
  // Les arrondis peuvent dépasser 1 de très peu
  return Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceA * varianceB)))
}

/** Rangs moyens : les ex æquo partagent la moyenne de leurs rangs. */
function averageRanks(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const rankOf = new Map<number, number>()
  sorted.forEach((value, index) => {
    if (rankOf.has(value)) return
    rankOf.set(value, index + (sorted.lastIndexOf(value) - index) / 2 + 1)
  })
  return values.map((value) => rankOf.get(value)!)
}

/** Corrélation de Spearman : celle de Pearson sur les rangs moyens. */
export function spearman(a: number[], b: number[]) {
  return pearson(averageRanks(a), averageRanks(b))
}

/**
 * Test d'une corrélation contre un seuil, par la transformation de Fisher : borne basse à 95 % et valeur p unilatérale
 * (« la corrélation dépasse le seuil »). Sans erreur type possible (3 valeurs ou moins), les deux sont null ;
 * une corrélation de 1 a une borne de 1 et une valeur p nulle, comme dans les logiciels de statistique (ADR-0063).
 */
export function fisherTest(correlation: number, n: number, threshold: number, varianceFactor = 1) {
  if (n <= 3) return { lower: null, pValue: null }
  if (correlation >= 1) return { lower: 1, pValue: 0 }
  if (correlation <= -1) return { lower: -1, pValue: 1 }
  const standardError = Math.sqrt(varianceFactor / (n - 3))
  const z = Math.atanh(correlation)
  return {
    lower: Math.tanh(z - Z_95 * standardError),
    pValue: normalSurvival((z - Math.atanh(threshold)) / standardError)
  }
}

/** Entropie de Shannon divisée par le logarithme du nombre d'options (Dahl et Østerås, 2010). */
export function normalizedEntropy(counts: number[], optionCount: number) {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (!total || optionCount < 2) return 0
  const entropy = counts.reduce((sum, count) => (count ? sum - (count / total) * Math.log(count / total) : sum), 0)
  return entropy / Math.log(optionCount)
}

/** Dispersion ordinale de Leik (1966) : 0 si tout le monde donne la même note, 1 si les réponses sont aux deux extrémités. */
export function leikDispersion(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (!total || counts.length < 2) return 0
  let cumulative = 0
  let sum = 0
  for (const count of counts.slice(0, -1)) {
    cumulative += count / total
    sum += cumulative < 0.5 ? cumulative : 1 - cumulative
  }
  return 2 * sum / (counts.length - 1)
}

/**
 * Tableau croisé : khi-deux de Pearson, V de Cramér corrigé du biais (Bergsma, 2013), conditions de Cochran
 * (aucun effectif attendu sous 1, au moins 80 % à 5 ou plus). Le tableau n'a ni ligne ni colonne vide.
 */
export function contingency(table: number[][]) {
  const rows = table.length
  const columns = table[0]?.length ?? 0
  const rowTotals = table.map((row) => row.reduce((sum, count) => sum + count, 0))
  const columnTotals = Array.from({ length: columns }, (_, column) => table.reduce((sum, row) => sum + row[column]!, 0))
  const n = rowTotals.reduce((sum, total) => sum + total, 0)
  const expected = rowTotals.map((rowTotal) => columnTotals.map((columnTotal) => rowTotal * columnTotal / n))
  const cells = expected.flat()
  const chiSquare = table.reduce((sum, row, r) => row.reduce((inner, count, c) => inner + (count - expected[r]![c]!) ** 2 / expected[r]![c]!, sum), 0)
  const cochran = cells.every((value) => value >= 1) && cells.filter((value) => value >= 5).length >= 0.8 * cells.length
  const df = (rows - 1) * (columns - 1)
  let cramerV = 0
  if (n > 1) {
    const corrected = Math.max(0, chiSquare / n - df / (n - 1))
    const smaller = Math.min(rows - (rows - 1) ** 2 / (n - 1), columns - (columns - 1) ** 2 / (n - 1)) - 1
    cramerV = smaller > 0 ? Math.sqrt(corrected / smaller) : 0
  }
  return { n, df, chiSquare, cramerV, cochran, expected }
}
