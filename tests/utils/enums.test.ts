// US-189 (ADR-0073) : les listes de valeurs du code et les énumérations de la base portent les mêmes valeurs. Une valeur
// ajoutée d'un seul côté serait refusée par la base, ou jamais proposée par l'application.
import { describe, expect, it } from 'vitest'
import * as Enums from '~/generated/prisma/enums'
import { PERSON_AFFINITY_KINDS } from '~/utils/affinityMatching'
import { ATTENDANCE_STATUSES } from '~/utils/attendance'
import { CHARACTER_RELATION_TYPE_VALUES } from '~/utils/characterRelations'
import { DOCUMENT_ROLES } from '~/utils/documentAudiences'
import {
  CHARACTER_TYPES,
  DOCUMENT_AUDIENCES,
  GAME_INVITATION_KINDS,
  GAME_INVITATION_STATUSES,
  GAME_SHARE_ROLES,
  INTRIGUE_LEVELS,
  REFUND_STATUSES,
  REGISTRATION_ANSWERS,
  REGISTRATION_PERIOD_STATES,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SELECTION_MODES,
  REGISTRATION_SESSION_STATUSES,
  REGISTRATION_SOURCES,
  REGISTRATION_STATUSES,
  SESSION_ROLES,
  SESSION_STATUSES,
  USER_ROLES
} from '~/utils/domain'
import { TARIFF_ROLES } from '~/utils/sessionTariffs'
import { ACCOUNT_TOKEN_KINDS } from '~/server/utils/accounts'

const values = (list: object) => Object.values(list).sort()

describe('listes du code et énumérations de la base', () => {
  it.each([
    ['CharacterType', CHARACTER_TYPES],
    ['CharacterRelationType', CHARACTER_RELATION_TYPE_VALUES],
    ['IntrigueLevel', INTRIGUE_LEVELS],
    ['DocumentRole', DOCUMENT_ROLES],
    ['DocumentAudience', DOCUMENT_AUDIENCES],
    ['SessionStatus', SESSION_STATUSES],
    ['RegistrationPeriodState', REGISTRATION_PERIOD_STATES],
    ['ReplayPolicy', REGISTRATION_REPLAY_POLICIES],
    ['SelectionMode', REGISTRATION_SELECTION_MODES],
    ['RegistrationStatus', REGISTRATION_STATUSES],
    ['RegistrationSource', REGISTRATION_SOURCES],
    ['RegistrationSessionStatus', REGISTRATION_SESSION_STATUSES],
    ['AvailabilityAnswer', REGISTRATION_ANSWERS],
    ['AffinityKind', [...PERSON_AFFINITY_KINDS, 'refusedRelations', 'refusedRelationTypes']],
    ['SessionRole', SESSION_ROLES],
    ['TariffRole', TARIFF_ROLES],
    ['RefundStatus', REFUND_STATUSES],
    ['UserRole', USER_ROLES],
    ['AccountTokenKind', ACCOUNT_TOKEN_KINDS],
    ['GameShareRole', GAME_SHARE_ROLES],
    ['GameInvitationStatus', GAME_INVITATION_STATUSES],
    ['GameInvitationKind', GAME_INVITATION_KINDS],
    ['AttendanceStatus', ATTENDANCE_STATUSES]
  ] as const)('%s', (name, list) => {
    expect(values(list)).toEqual(values(Enums[name]))
  })
})
