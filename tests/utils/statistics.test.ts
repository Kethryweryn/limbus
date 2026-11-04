import { describe, expect, it } from 'vitest'
import { chiSquareSurvival, contingency, fisherTest, holmAdjust, leikDispersion, noncentralChiSquareSurvival, normalizedEntropy, normalSurvival, pearson, spearman, wilsonInterval } from '~/utils/statistics'

// Valeurs de référence calculées avec SciPy 1.15 (stats.norm, chi2, ncx2, spearmanr, pearsonr, chi2_contingency, entropy)
describe('lois de probabilité', () => {
  it('loi normale', () => {
    expect(normalSurvival(1.96)).toBeCloseTo(0.024997895148220435, 10)
    expect(normalSurvival(-1)).toBeCloseTo(0.8413447460685429, 10)
    expect(normalSurvival(3)).toBeCloseTo(0.001349898031630093, 10)
    expect(normalSurvival(0)).toBeCloseTo(0.5, 10)
  })

  it('khi-deux', () => {
    expect(chiSquareSurvival(3.841458820694124, 1)).toBeCloseTo(0.05, 10)
    expect(chiSquareSurvival(10, 4)).toBeCloseTo(0.04042768199451279, 10)
  })

  it('khi-deux non central', () => {
    expect(noncentralChiSquareSurvival(10, 3, 5)).toBeCloseTo(0.29335135222254816, 8)
    expect(noncentralChiSquareSurvival(12, 4, 7.5)).toBeCloseTo(0.4083028648826451, 8)
    expect(noncentralChiSquareSurvival(40, 6, 12.5)).toBeCloseTo(0.011741656553924536, 8)
    expect(noncentralChiSquareSurvival(10, 4, 0)).toBeCloseTo(0.04042768199451279, 10)
  })
})

describe('Wilson et Holm', () => {
  it('intervalle de Wilson', () => {
    const { lower, upper } = wilsonInterval(8, 10)
    expect(lower).toBeCloseTo(0.4902, 3)
    expect(upper).toBeCloseTo(0.9433, 3)
    // Avec 100 % de réponses, la borne basse vaut n / (n + z²) : elle atteint 0,8 à partir de 16 réponses
    expect(wilsonInterval(15, 15).lower).toBeLessThan(0.8)
    expect(wilsonInterval(16, 16).lower).toBeGreaterThan(0.8)
    expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 1 })
  })

  it('valeurs p de Holm, dans l’ordre reçu et monotones', () => {
    const adjusted = holmAdjust([0.01, 0.04, 0.03, 0.2])
    expect(adjusted[0]).toBeCloseTo(0.04)
    expect(adjusted[1]).toBeCloseTo(0.09)
    expect(adjusted[2]).toBeCloseTo(0.09)
    expect(adjusted[3]).toBeCloseTo(0.2)
    expect(holmAdjust([0.9, 0.9])).toEqual([1, 1])
    expect(holmAdjust([])).toEqual([])
  })
})

describe('corrélations', () => {
  const x = [1, 2, 2, 3, 4, 5, 5, 1]
  const y = [2, 2, 3, 3, 5, 4, 5, 1]

  it('Pearson et Spearman, ex æquo compris', () => {
    expect(pearson(x, y)).toBeCloseTo(0.9026583750358559, 10)
    expect(spearman(x, y)).toBeCloseTo(0.9012345679012347, 10)
  })

  it('une variable constante n’a pas de corrélation', () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull()
    expect(pearson([1], [1])).toBeNull()
  })

  it('test de Fisher contre un seuil', () => {
    const { lower, pValue } = fisherTest(0.9, 20, 0.85)
    expect(lower).toBeCloseTo(0.7602716043542946, 10)
    expect(pValue).toBeCloseTo(0.18650060259879425, 10)
  })

  it('test de Fisher : 3 valeurs ou moins, et corrélations extrêmes', () => {
    expect(fisherTest(0.9, 3, 0.85)).toEqual({ lower: null, pValue: null })
    expect(fisherTest(1, 4, 0.85)).toEqual({ lower: 1, pValue: 0 })
    expect(fisherTest(-1, 4, 0.85)).toEqual({ lower: -1, pValue: 1 })
  })
})

describe('dispersion', () => {
  it('entropie normalisée', () => {
    expect(normalizedEntropy([8, 1, 1], 3)).toBeCloseTo(0.5816718657178868, 10)
    expect(normalizedEntropy([5, 5], 2)).toBeCloseTo(1)
    expect(normalizedEntropy([5, 0, 0], 3)).toBe(0)
  })

  it('dispersion de Leik : 0 pour une seule note, 1 pour deux extrémités', () => {
    expect(leikDispersion([0, 0, 10, 0, 0])).toBe(0)
    expect(leikDispersion([5, 0, 0, 0, 5])).toBeCloseTo(1)
    expect(leikDispersion([2, 2, 2, 2, 2])).toBeCloseTo(0.6)
  })
})

describe('tableau croisé', () => {
  it('khi-deux, V corrigé de Bergsma et effectifs attendus', () => {
    const result = contingency([[10, 2, 1], [1, 9, 3]])
    expect(result.chiSquare).toBeCloseTo(12.818181818181817, 10)
    expect(result.cramerV).toBeCloseTo(0.6559082387923006, 10)
    expect(result.df).toBe(2)
    expect(result.expected).toEqual([[5.5, 5.5, 2], [5.5, 5.5, 2]])
    // Effectifs attendus : 4 cases sur 6 à 5 ou plus, sous les 80 % de Cochran
    expect(result.cochran).toBe(false)
  })

  it('conditions de Cochran remplies, et V nul sans association', () => {
    const result = contingency([[10, 10], [10, 10]])
    expect(result.cochran).toBe(true)
    expect(result.cramerV).toBe(0)
  })

  it('un effectif attendu sous 1 ne remplit pas les conditions', () => {
    expect(contingency([[20, 1], [20, 0]]).cochran).toBe(false)
  })
})
