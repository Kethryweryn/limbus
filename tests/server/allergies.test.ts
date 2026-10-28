import { describe, expect, it } from 'vitest'
import { allergySheetEmailText, buildAllergySheet, renderAllergySheetPdf } from '~/server/utils/allergies'

const session = {
  name: 'Printemps',
  date: new Date('2027-03-10T09:00:00Z'),
  game: { title: 'Les Ombres' },
  registrations: [
    { dietary: 'Gluten', participant: { name: 'Zoé Martin' } },
    { dietary: '  ', participant: { name: 'Hugo Petit' } },
    { dietary: null, participant: { name: 'Léo Blanc' } },
    { dietary: ' Arachides\nLactose ', participant: { name: 'Inès Roy' } }
  ]
}

describe('fiche allergies (US-008)', () => {
  it('liste les personnes qui ont déclaré quelque chose, par nom, et compte toutes les personnes confirmées', () => {
    const sheet = buildAllergySheet(session)
    expect(sheet.confirmedCount).toBe(4)
    expect(sheet.people).toEqual([
      { name: 'Inès Roy', dietary: 'Arachides\nLactose' },
      { name: 'Zoé Martin', dietary: 'Gluten' }
    ])
  })

  it('ne contient que le nom et les allergies : ni téléphone, ni contact d’urgence, ni email', () => {
    const sheet = buildAllergySheet({
      ...session,
      registrations: [{ dietary: 'Gluten', participant: { name: 'Zoé Martin' }, phone: '0612345678', emergencyContactPhone: '0699999999' } as never]
    })
    expect(JSON.stringify(sheet)).not.toMatch(/06\d{8}/)
    expect(Object.keys(sheet.people[0]!)).toEqual(['name', 'dietary'])
  })

  it('l’email rappelle que ce sont des données de santé', () => {
    const text = allergySheetEmailText(buildAllergySheet(session))
    expect(text).toContain('session Printemps (« Les Ombres »)')
    expect(text).toContain('4 personnes confirmées, dont 2 personnes avec allergies ou intolérances')
    expect(text).toContain('données de santé')
  })

  it('produit un PDF, même sans allergie déclarée', async () => {
    const pdf = await renderAllergySheetPdf(buildAllergySheet({ ...session, registrations: [] }))
    expect(Buffer.from(pdf.bytes).subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.filename).toBe('allergies-printemps.pdf')
  })
})
