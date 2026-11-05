import { describe, expect, it } from 'vitest'
import { registrationAnswerSchema } from '~/server/utils/registrationForms'
import { registrationFormDefinitionSchema } from '~/server/utils/schemas'
import {
  DEFAULT_REGISTRATION_FORM_DEFINITION,
  normalizeRegistrationFormDefinition,
  sameRegistrationFormDefinition,
  shuffledOptions,
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

  // US-146 : mélange des options
  it('ne garde le mélange que coché, sur une question à choix', () => {
    const questions = normalizeRegistrationFormDefinition({
      ...DEFAULT_REGISTRATION_FORM_DEFINITION,
      questions: [
        { id: 'a', label: 'A', type: 'single', required: false, options: ['x', 'y'], shuffleOptions: true },
        { id: 'b', label: 'B', type: 'multiple', required: false, options: ['x', 'y'], shuffleOptions: false },
        { id: 'c', label: 'C', type: 'scale', required: false, options: [], shuffleOptions: true },
        { id: 'd', label: 'D', type: 'text', required: false, options: [], shuffleOptions: true }
      ]
    }).questions
    expect(questions.map((question) => question.shuffleOptions)).toEqual([true, undefined, undefined, undefined])
    expect(Object.keys(questions[1]!)).not.toContain('shuffleOptions')
  })

  it('un formulaire d’avant le mélange reste identique, et le cocher le change', () => {
    const question = { id: 'a', label: 'A', type: 'single' as const, required: false, options: ['x', 'y'] }
    const before = { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: [question] }
    expect(sameRegistrationFormDefinition(before, { ...before, questions: [{ ...question, shuffleOptions: false }] })).toBe(true)
    expect(sameRegistrationFormDefinition(before, { ...before, questions: [{ ...question, shuffleOptions: true }] })).toBe(false)
  })

  it('mélange sans perdre d’option, selon le générateur', () => {
    const options = ['a', 'b', 'c', 'd']
    expect(shuffledOptions(options, () => 0)).toEqual(['b', 'c', 'd', 'a'])
    expect(shuffledOptions(options, () => 0.999)).toEqual(options)
    expect([...shuffledOptions(options)].sort()).toEqual(options)
    expect(options).toEqual(['a', 'b', 'c', 'd'])
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
    expect(parsed.affinities).toEqual({ wantWith: ['Léa'], notWith: [], refusedRelations: [], avoid: [], refusedRelationTypes: [] })
    expect(parsed.questionAnswers).toEqual({ 'q-texte': null, 'q-choix': 'Intrigue' })
    expect(schema.safeParse({ ...answers, affinities: { wantWith: ['Léa'] }, questionAnswers: { 'q-choix': 'Autre' } }).success).toBe(false)
    expect(schema.safeParse({ ...answers, questionAnswers: { 'q-choix': 'Combat' } }).success).toBe(false)
    // Les lignes vides ne comptent pas dans la limite de 20
    const lines = [...Array(18).fill('Nom'), '', '', '', '']
    expect(schema.parse({ ...answers, affinities: { wantWith: lines }, questionAnswers: { 'q-choix': 'Intrigue' } }).affinities.wantWith).toHaveLength(18)
  })

  it('relations refusées : des cases ou du texte suffisent, « Aucune » se coche seule (US-099)', () => {
    const schema = registrationAnswerSchema({ ...DEFAULT_REGISTRATION_FORM_DEFINITION, affinities: { refusedRelations: { asked: true, required: true } } })
    const affinitiesOf = (affinities: unknown) => schema.safeParse({ ...answers, affinities })
    expect(affinitiesOf({}).success).toBe(false)
    expect(affinitiesOf({ refusedRelationTypes: ['none'] }).success).toBe(true)
    expect(affinitiesOf({ refusedRelations: ['Pas de trahison'] }).success).toBe(true)
    expect(affinitiesOf({ refusedRelationTypes: ['none', 'romance'] }).success).toBe(false)
    expect(affinitiesOf({ refusedRelationTypes: ['inconnu'] }).success).toBe(false)
    const parsed = schema.parse({ ...answers, affinities: { refusedRelationTypes: ['romance', 'family', 'romance'] } })
    expect(parsed.affinities.refusedRelationTypes).toEqual(['romance', 'family'])
    // Non demandée, la question ne garde rien
    expect(registrationAnswerSchema(DEFAULT_REGISTRATION_FORM_DEFINITION).parse({ ...answers, affinities: { refusedRelationTypes: ['romance'] } }).affinities.refusedRelationTypes).toEqual([])
  })
})

describe('question d’équilibre (US-091)', () => {
  const base = { ...DEFAULT_REGISTRATION_FORM_DEFINITION, standardFields: Object.fromEntries(Object.keys(DEFAULT_REGISTRATION_FORM_DEFINITION.standardFields).map((key) => [key, { asked: false, required: false }])) } as typeof DEFAULT_REGISTRATION_FORM_DEFINITION
  const withBalance = (required: boolean) => ({ ...base, balance: { asked: true, required, label: 'Genre', values: ['F', 'H'] } })
  const answer = (balancePreference?: unknown) => ({ email: 'a@example.test', charterAccepted: true, balancePreference })

  it('accepte une valeur du jeu, « peu importe » enregistré comme null, et refuse une autre valeur', () => {
    const schema = registrationAnswerSchema(withBalance(true))
    expect(schema.parse(answer('F')).balancePreference).toBe('F')
    expect(schema.parse(answer('*')).balancePreference).toBeNull()
    expect(schema.safeParse(answer('X')).success).toBe(false)
    expect(schema.safeParse(answer()).success).toBe(false)
  })

  it('facultative, elle peut rester sans réponse ; non demandée, elle est ignorée', () => {
    expect(registrationAnswerSchema(withBalance(false)).parse(answer()).balancePreference).toBeNull()
    expect(registrationAnswerSchema(base).parse(answer('F')).balancePreference).toBeNull()
  })
})

