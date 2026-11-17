import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { assertChangedPersonName, assertChangedPhone, enteredPhone, isPersonName, normalizePhone, optionalEmail, optionalPersonName, optionalPhone, optionalTextField, personName, PHONE_MESSAGE, refineEmergencyContact, requiredEmail, requiredPhone, requiredTextField, TEXT_MAX, tooLong } from '~/server/utils/fieldRules'

const message = 'Le nom ne peut contenir que des lettres, des espaces, des traits d’union, des apostrophes et des points'

describe('personName (SPEC-023, R1)', () => {
  it('accepte les lettres de tout alphabet et les séparateurs', () => {
    for (const name of ['Jean-Pierre O\'Neill', 'Zoë Ŝ. Müller', 'Мария', 'Anaïs D’Arc', '\'t Hooft', 'Lê Văn Thành']) {
      expect(isPersonName(name), name).toBe(true)
    }
  })

  it('refuse un chiffre, un symbole ou un nom sans lettre', () => {
    for (const name of ['Jean2', '@lice', '-', '. \'', 'Léa_Martin', 'Bob 🙂']) {
      expect(isPersonName(name), name).toBe(false)
    }
    const refused = personName().safeParse('Jean2')
    expect(refused.success).toBe(false)
    expect(refused.error?.issues[0]?.message).toBe(message)
  })

  it('retire les espaces en double ou aux extrémités', () => {
    expect(personName().parse('  Jean   Martin ')).toBe('Jean Martin')
  })

  it('exige un nom, de 100 caractères au plus', () => {
    expect(personName().safeParse('   ').error?.issues[0]?.message).toBe('Le nom est obligatoire')
    expect(personName().safeParse(undefined).error?.issues[0]?.message).toBe('Le nom est obligatoire')
    expect(personName().safeParse('a'.repeat(101)).error?.issues[0]?.message).toBe('Le nom : 100 caractères au plus')
    expect(personName().parse('a'.repeat(100))).toHaveLength(100)
  })

  it('facultatif : vide ou absent devient null, sinon la même règle', () => {
    const optional = optionalPersonName('Le nom du contact d’urgence')
    expect(optional.parse('')).toBeNull()
    expect(optional.parse('  ')).toBeNull()
    expect(optional.parse(null)).toBeNull()
    expect(optional.parse(undefined)).toBeNull()
    expect(optional.parse(' Paul  Martin')).toBe('Paul Martin')
    expect(optional.safeParse('Paul 2').error?.issues[0]?.message).toBe('Le nom du contact d’urgence ne peut contenir que des lettres, des espaces, des traits d’union, des apostrophes et des points')
  })
})

describe('assertChangedPersonName (SPEC-023, R12)', () => {
  it('laisse passer un nom enregistré inchangé, aux espaces près, et vérifie un nom modifié', () => {
    expect(() => assertChangedPersonName('name', 'Le nom', 'Ancien 2', ['Ancien  2 '])).not.toThrow()
    expect(() => assertChangedPersonName('name', 'Le nom', null, ['x'])).not.toThrow()
    expect(() => assertChangedPersonName('name', 'Le nom', 'Léa Martin', [null])).not.toThrow()
    expect(() => assertChangedPersonName('name', 'Le nom', 'Ancien 3', ['Ancien 2'])).toThrow(expect.objectContaining({ statusCode: 400, data: expect.objectContaining({ data: [{ path: 'name', message }] }) }))
  })
})

describe('téléphones (SPEC-023, R4 à R6)', () => {
  it('range au format international un numéro français, avec ou sans séparateurs ni indicatif', () => {
    for (const typed of ['06 12 34 56 78', '06.12.34.56.78', '06-12-34-56-78', '(06) 12 34 56 78', '+33 (0)6 12 34 56 78', '0033612345678', '+33612345678']) {
      expect(normalizePhone(typed), typed).toBe('+33612345678')
    }
  })

  it('vérifie un numéro étranger selon son pays', () => {
    expect(normalizePhone('+32 470 12 34 56')).toBe('+32470123456')
    expect(normalizePhone('0032 470 12 34 56')).toBe('+32470123456')
    expect(normalizePhone('+41 79 123 45 67')).toBe('+41791234567')
  })

  it('refuse ce qui n’est pas un numéro, même s’il en contient un', () => {
    for (const typed of ['12', 'bonjour', '06 12 34', '07 00 00 00 00', 'tél. 06 12 34 56 78', '0612345678 poste 2', '+33 6 12 34 56 78 9']) {
      expect(normalizePhone(typed), typed).toBeNull()
    }
  })

  it('obligatoire ou facultatif, avec le message du champ', () => {
    expect(requiredPhone().parse(' 06 12 34 56 78 ')).toBe('+33612345678')
    expect(requiredPhone().safeParse('').error?.issues[0]?.message).toBe('Le téléphone est obligatoire')
    expect(requiredPhone().safeParse('12').error?.issues[0]?.message).toBe(PHONE_MESSAGE)
    expect(optionalPhone().parse('  ')).toBeNull()
    expect(optionalPhone().parse(undefined)).toBeNull()
    expect(optionalPhone().safeParse('bonjour').error?.issues[0]?.message).toBe(PHONE_MESSAGE)
  })

  it('une modification garde un numéro non reconnu tel quel, refusé seulement s’il change (R12)', () => {
    expect(enteredPhone().parse('06 12 34 56 78')).toBe('+33612345678')
    expect(enteredPhone().parse(' standard ')).toBe('standard')
    expect(enteredPhone().parse('')).toBeNull()
    expect(() => assertChangedPhone('phone', 'standard', ['standard '])).not.toThrow()
    expect(() => assertChangedPhone('phone', '+33612345678', [null])).not.toThrow()
    expect(() => assertChangedPhone('phone', null, ['x'])).not.toThrow()
    expect(() => assertChangedPhone('phone', 'autre', ['standard'])).toThrow(expect.objectContaining({ statusCode: 400, data: expect.objectContaining({ data: [{ path: 'phone', message: PHONE_MESSAGE }] }) }))
  })
})

describe('contact d’urgence complet (SPEC-023, R8)', () => {
  const contact = z.object({ emergencyContactName: z.string().nullable(), emergencyContactPhone: z.string().nullable() }).superRefine(refineEmergencyContact)
  const refused = (value: { emergencyContactName: string | null, emergencyContactPhone: string | null }) =>
    contact.safeParse(value).error?.issues.map((issue) => [issue.path.join('.'), issue.message])

  it('refuse un nom sans téléphone, et un téléphone sans nom, sous le champ vide', () => {
    expect(refused({ emergencyContactName: 'Paul', emergencyContactPhone: null })).toEqual([['emergencyContactPhone', 'Le téléphone du contact d’urgence est obligatoire']])
    expect(refused({ emergencyContactName: null, emergencyContactPhone: '+33612345678' })).toEqual([['emergencyContactName', 'Le nom du contact d’urgence est obligatoire']])
  })

  it('accepte les deux, ou aucun', () => {
    expect(contact.safeParse({ emergencyContactName: 'Paul', emergencyContactPhone: '+33612345678' }).success).toBe(true)
    expect(contact.safeParse({ emergencyContactName: null, emergencyContactPhone: null }).success).toBe(true)
  })
})

describe('longueurs maximales (SPEC-023, R9)', () => {
  it('donne à chaque type de texte son plafond, avec un message lisible', () => {
    expect(TEXT_MAX).toEqual({ personName: 100, title: 200, short: 500, long: 50_000, background: 1_000_000 })
    expect(tooLong('Le background', 1_000_000)).toBe('Le background : 1 000 000 caractères au plus')
    expect(tooLong('Le nom', 200)).toBe('Le nom : 200 caractères au plus')
  })

  it('accepte un texte à son plafond et refuse un caractère de plus', () => {
    expect(requiredTextField('title', 'Le nom').parse(' ' + 'a'.repeat(200) + ' ')).toHaveLength(200)
    expect(requiredTextField('title', 'Le nom').safeParse('a'.repeat(201)).error?.issues[0]?.message).toBe('Le nom : 200 caractères au plus')
    expect(requiredTextField('title', 'Le nom').safeParse('  ').error?.issues[0]?.message).toBe('Le nom est obligatoire')
    expect(optionalTextField('background', 'L’historique').parse('a'.repeat(1_000_000))).toHaveLength(1_000_000)
    expect(optionalTextField('background', 'L’historique').safeParse('a'.repeat(1_000_001)).success).toBe(false)
    expect(optionalTextField('long', 'La description').parse(null)).toBeNull()
  })
})

describe('emails (SPEC-023, R10)', () => {
  it('obligatoire : en minuscules, de la forme d’une adresse, 254 caractères au plus', () => {
    expect(requiredEmail().parse(' Lea@Example.TEST ')).toBe('lea@example.test')
    expect(requiredEmail().safeParse('pas-une-adresse').error?.issues[0]?.message).toBe('Email invalide')
    expect(requiredEmail().safeParse('').error?.issues.map((issue) => issue.message)).toEqual(['L’email est obligatoire'])
    expect(requiredEmail().safeParse(`${'a'.repeat(250)}@x.fr`).error?.issues[0]?.message).toBe('L’email : 254 caractères au plus')
  })

  it('facultative : vide, absente ou nulle, elle le reste (une modification lit l’absence comme « inchangée »)', () => {
    expect(optionalEmail().parse(undefined)).toBeUndefined()
    expect(optionalEmail().parse(null)).toBeNull()
    expect(optionalEmail().parse('  ')).toBe('')
    expect(optionalEmail().parse(' Contact@Jeu.TEST')).toBe('contact@jeu.test')
    expect(optionalEmail().safeParse('contact').error?.issues[0]?.message).toBe('Email invalide')
  })
})
