import { describe, expect, it } from 'vitest'
import { registrationAnswerSchema } from '~/server/utils/registrationForms'
import { registrationFormDefinitionSchema } from '~/server/utils/schemas'
import {
  DEFAULT_REGISTRATION_FORM_DEFINITION,
  normalizeRegistrationFormDefinition,
  sameRegistrationFormDefinition,
  type RegistrationFormDefinition
} from '~/utils/registrationForms'

function definitionWith(changes: Partial<RegistrationFormDefinition['standardFields']>): RegistrationFormDefinition {
  return { standardFields: { ...DEFAULT_REGISTRATION_FORM_DEFINITION.standardFields, ...changes } }
}

const answers = {
  email: ' Joueuse@Example.TEST ',
  lastName: 'Martin',
  firstName: 'Léa',
  phone: '0600000000',
  emergencyContactName: 'Paul Martin',
  emergencyContactPhone: '0611111111',
  charterAccepted: true
}

describe('définition du formulaire', () => {
  it('rend facultatif un champ non demandé', () => {
    const normalized = normalizeRegistrationFormDefinition(definitionWith({ phone: { asked: false, required: true } }))
    expect(normalized.standardFields.phone).toEqual({ asked: false, required: false })
  })

  it('compare deux définitions après normalisation', () => {
    expect(sameRegistrationFormDefinition(
      definitionWith({ phone: { asked: false, required: true } }),
      definitionWith({ phone: { asked: false, required: false } })
    )).toBe(true)
    expect(sameRegistrationFormDefinition(DEFAULT_REGISTRATION_FORM_DEFINITION, definitionWith({ phone: { asked: false, required: false } }))).toBe(false)
  })

  it('refuse une définition incomplète ou inconnue', () => {
    expect(registrationFormDefinitionSchema.safeParse(DEFAULT_REGISTRATION_FORM_DEFINITION).success).toBe(true)
    expect(registrationFormDefinitionSchema.safeParse({ standardFields: { phone: { asked: true, required: true } } }).success).toBe(false)
    expect(registrationFormDefinitionSchema.safeParse({}).success).toBe(false)
  })
})

describe('réponses d’un inscrit', () => {
  it('accepte des réponses complètes et normalise l’email', () => {
    const parsed = registrationAnswerSchema(DEFAULT_REGISTRATION_FORM_DEFINITION).parse(answers)
    expect(parsed).toMatchObject({ email: 'joueuse@example.test', lastName: 'Martin', dietary: null, healthConsent: false })
  })

  it('exige les champs obligatoires et l’adhésion à la note d’intention', () => {
    const schema = registrationAnswerSchema(DEFAULT_REGISTRATION_FORM_DEFINITION)
    expect(schema.safeParse({ ...answers, phone: '  ' }).success).toBe(false)
    expect(schema.safeParse({ ...answers, emergencyContactPhone: undefined }).success).toBe(false)
    expect(schema.safeParse({ ...answers, charterAccepted: false }).success).toBe(false)
    expect(schema.safeParse({ ...answers, email: 'pas-un-email' }).success).toBe(false)
  })

  it('un champ obligatoire laissé vide (null) a un message en français', () => {
    const result = registrationAnswerSchema(DEFAULT_REGISTRATION_FORM_DEFINITION).safeParse({ ...answers, phone: null, email: null })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['L’email est obligatoire', 'Le téléphone est obligatoire'])
  })

  it('exige le consentement quand des allergies sont déclarées', () => {
    const schema = registrationAnswerSchema(DEFAULT_REGISTRATION_FORM_DEFINITION)
    const refused = schema.safeParse({ ...answers, dietary: 'Arachides' })
    expect(refused.success).toBe(false)
    expect(refused.error?.issues[0]?.path).toEqual(['healthConsent'])

    expect(schema.parse({ ...answers, dietary: 'Arachides', healthConsent: true }).dietary).toBe('Arachides')
  })

  it('ignore un champ non demandé, même s’il est envoyé', () => {
    const schema = registrationAnswerSchema(definitionWith({
      phone: { asked: false, required: false },
      dietary: { asked: false, required: false }
    }))
    const parsed = schema.parse({ ...answers, phone: undefined, dietary: 'Arachides' })
    expect(parsed.phone).toBeNull()
    expect(parsed.dietary).toBeNull()
  })

  it('laisse vide un champ facultatif', () => {
    const schema = registrationAnswerSchema(definitionWith({ facebookName: { asked: true, required: false } }))
    expect(schema.parse({ ...answers, facebookName: '' }).facebookName).toBeNull()
  })
})

// EPIC-019 : questions propres au jeu et affinités (US-081, US-082)
describe('questions et affinités du formulaire', () => {
  const withExtras: RegistrationFormDefinition = {
    ...DEFAULT_REGISTRATION_FORM_DEFINITION,
    affinities: { wantWith: { asked: true, required: true }, avoid: { asked: false, required: true } },
    questions: [
      { id: 'q-texte', label: ' Pourquoi ? ', type: 'text', required: false, options: ['ignorée'] },
      { id: 'q-choix', label: 'Style', type: 'single', required: true, options: ['Combat', ' Combat ', 'Intrigue', ''] }
    ]
  }

  it('lit une ancienne définition sans affinités ni questions', () => {
    const normalized = normalizeRegistrationFormDefinition(DEFAULT_REGISTRATION_FORM_DEFINITION)
    expect(normalized.questions).toEqual([])
    expect(Object.values(normalized.affinities).every((setting) => !setting.asked)).toBe(true)
  })

  it('nettoie libellés et options, et rend facultative une affinité non demandée', () => {
    const normalized = normalizeRegistrationFormDefinition(withExtras)
    expect(normalized.questions[0]).toMatchObject({ label: 'Pourquoi ?', options: [] })
    expect(normalized.questions[1]!.options).toEqual(['Combat', 'Intrigue'])
    expect(normalized.affinities.avoid).toEqual({ asked: false, required: false })
  })

  it('valide les réponses selon la version', () => {
    const schema = registrationAnswerSchema(withExtras)
    const parsed = schema.parse({ ...answers, affinities: { wantWith: ['Léa', ''], avoid: ['ignorée'] }, questionAnswers: { 'q-choix': 'Intrigue', autre: 'x' } })
    expect(parsed.affinities).toEqual({ wantWith: ['Léa'], notWith: [], refusedRelations: [], avoid: [] })
    expect(parsed.questionAnswers).toEqual({ 'q-texte': null, 'q-choix': 'Intrigue' })
    expect(schema.safeParse({ ...answers, affinities: { wantWith: ['Léa'] }, questionAnswers: { 'q-choix': 'Autre' } }).success).toBe(false)
    expect(schema.safeParse({ ...answers, questionAnswers: { 'q-choix': 'Combat' } }).success).toBe(false)
    // Les lignes vides ne comptent pas dans la limite de 20
    const lines = [...Array(18).fill('Nom'), '', '', '', '']
    expect(schema.parse({ ...answers, affinities: { wantWith: lines }, questionAnswers: { 'q-choix': 'Intrigue' } }).affinities.wantWith).toHaveLength(18)
  })
})
