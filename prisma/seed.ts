import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import slugify from 'slugify'
import { hashPassword } from '../server/utils/passwordHash'
import { prisma } from '../server/utils/prisma'
import { collectUploadUrls, deleteUnusedUploads, uploadDir, UPLOAD_DIRS } from '../server/utils/uploads'
import { TERMS_VERSION } from '../utils/legal'
import { PHOTO_UPLOAD_PREFIX } from '../utils/urls'
import { BAL_EXTRA_PEOPLE, createBalStage } from './seed/bal'
import type { Db, StageContext } from './seed/db'
import { createMeridianStage, MERIDIAN_EXTRA_PEOPLE } from './seed/meridian'
import { daysFromNow, personAddress, readSeedOptions, type SeedOptions } from './seed/options'
import { placePlayersInPool } from './seed/pool'
import { createValombreStage } from './seed/valombre'
import type { GameShareRole } from '../generated/prisma/enums'

// La transaction du rechargement, utilisée par toutes les fonctions du script : un échec laisse les jeux tels quels
let db: Db

const RELOAD_TIMEOUT_MS = 10 * 60 * 1000

type CharacterSeed = {
  name: string
  pitch: string
  type?: 'pj' | 'pnj'
  background?: string
  costumeIndications?: string
  trombinoscopeFaceHidden?: boolean
  trombinoscopeDisplayName?: string
  trombinoscopeNote?: string
  excludeFromTrombinoscope?: boolean
}

type FactionSeed = {
  name: string
  pitch: string
  characterNames: string[]
  showInTrombinoscope?: boolean
}

type IntrigueSeed = {
  name: string
  pitch: string
  description: string
  level: 'main_story' | 'main_character' | 'major' | 'minor'
  characterNames: string[]
  factionNames: string[]
}

type ParticipantSeed = {
  name: string
  email: string
  phone: string
  notes?: string
}

type LocationSeed = {
  name: string
  address: string
  notes?: string
}

type ItemSeed = {
  name: string
  description: string
  locationText?: string
  locationCharacterName?: string
  characterNames: string[]
  intrigueNames: string[]
}

type GameSeed = {
  // Identifiant fixe : un jeu renommé reste reconnu, et le jeu d'une autre personne n'est jamais pris pour lui (ADR-0066)
  id: string
  // L'étape de la vie d'un jeu que ce jeu montre, avec ses sessions à venir (ADR-0066)
  createStage: (db: Db, context: StageContext) => Promise<void>
  title: string
  description: string
  noteIntention: string
  characters: CharacterSeed[]
  factions: FactionSeed[]
  intrigues: IntrigueSeed[]
  participants: ParticipantSeed[]
  locations: LocationSeed[]
  items: ItemSeed[]
}

type PreservedAccess = {
  gameId: string
  shares: Array<{ userId: string, role: GameShareRole }>
  aiAuthorizationIds: string[]
}

const TEST_ACCOUNTS = [
  {
    key: 'ines',
    name: 'Inès Lefèvre',
    email: 'ines.lefevre@example.test',
    phone: '06 11 22 33 10',
    emergencyContactName: 'Paul Lefèvre',
    emergencyContactPhone: '06 55 00 00 10',
    dietary: null
  },
  {
    key: 'camille',
    name: 'Camille Bernard',
    email: 'camille.bernard@example.test',
    phone: '06 11 22 33 01',
    emergencyContactName: 'Aline Bernard',
    emergencyContactPhone: '06 55 00 00 01',
    dietary: 'Végétarienne, allergie aux fruits à coque'
  },
  {
    key: 'lucie',
    name: 'Lucie Moreau',
    email: 'lucie.moreau@example.test',
    phone: '06 11 22 33 02',
    emergencyContactName: 'Marc Moreau',
    emergencyContactPhone: '06 55 00 00 02',
    dietary: null
  }
]

// Inès co-organise ces jeux, et pas le troisième, pour montrer aussi un refus
const CO_ORGANIZED_GAME_IDS = ['jeu-test-valombre', 'jeu-test-meridian']

const games: GameSeed[] = [
  {
    id: 'jeu-test-valombre',
    createStage: createValombreStage,
    title: 'Les Cendres de Valombre',
    description: 'Un huis clos politique dans une baronnie frontalière où une succession fragile menace de rallumer une guerre ancienne.',
    noteIntention: 'Mettre en tension alliances familiales, secrets de guerre et choix moraux.',
    characters: [
      { name: 'Aélis de Valombre', pitch: 'Héritière officielle de la baronnie, brillante mais isolée.' },
      { name: 'Marceau Trelane', pitch: 'Capitaine de la garde, loyal à la ville plus qu’aux nobles.' },
      { name: 'Sœur Ysilde', pitch: 'Archiviste du temple, détentrice de confessions dangereuses.' },
      { name: 'Corvin le Noir', pitch: 'Émissaire d’une maison rivale, charmeur et opportuniste.' },
      { name: 'Nora Fiel', pitch: 'Cheffe des artisans, lasse de payer pour les querelles des puissants.' },
      { name: 'Bastian Lorme', pitch: 'Barde itinérant qui en sait trop sur la mort du baron.' },
      { name: 'Hélène de Briseciel', pitch: 'Diplomate venue négocier une paix impossible.', type: 'pnj', trombinoscopeFaceHidden: true },
      { name: 'Toma le Rouge', pitch: 'Ancien contrebandier devenu informateur de la garde.', type: 'pnj', trombinoscopeDisplayName: 'Informateur anonyme' }
    ],
    factions: [
      {
        name: 'La Maison de Valombre',
        pitch: 'Le cercle noble qui tente de préserver la légitimité de la succession.',
        characterNames: ['Aélis de Valombre', 'Hélène de Briseciel'],
        showInTrombinoscope: true
      },
      {
        name: 'La Ville basse',
        pitch: 'Artisans, informateurs et figures populaires décidés à ne plus subir les décisions des puissants.',
        characterNames: ['Nora Fiel', 'Toma le Rouge', 'Bastian Lorme']
      }
    ],
    intrigues: [
      {
        name: 'La succession du baron',
        pitch: 'La mort du baron ouvre une crise politique qui menace toute la vallée.',
        description: 'Plusieurs camps cherchent à imposer leur lecture du testament et à contrôler la transition avant que les maisons voisines ne s’en mêlent.',
        level: 'main_story',
        characterNames: ['Aélis de Valombre', 'Corvin le Noir', 'Hélène de Briseciel'],
        factionNames: ['La Maison de Valombre']
      },
      {
        name: 'Les dettes de la Ville basse',
        pitch: 'Les artisans et contrebandiers possèdent des informations capables de renverser les négociations.',
        description: 'Cette intrigue suit les promesses non tenues par l’ancienne baronnie et les preuves que la Ville basse peut utiliser pour obtenir des garanties.',
        level: 'major',
        characterNames: ['Nora Fiel', 'Toma le Rouge', 'Bastian Lorme'],
        factionNames: ['La Ville basse']
      },
      {
        name: 'La confession disparue',
        pitch: 'Une confession consignée par le temple a été volée avant d’être archivée.',
        description: 'Le document manquant relie plusieurs personnages à la nuit de la mort du baron.',
        level: 'minor',
        characterNames: ['Sœur Ysilde', 'Bastian Lorme'],
        factionNames: []
      },
      {
        name: 'La rumeur sans porteur',
        pitch: 'Une rumeur circule sans que personne ne semble encore vouloir s’en charger.',
        description: 'Intrigue volontairement non associée pour tester le signalement des intrigues orphelines.',
        level: 'minor',
        characterNames: [],
        factionNames: []
      }
    ],
    participants: [
      { name: 'Camille Bernard', email: 'camille.bernard@example.test', phone: '06 11 22 33 01' },
      { name: 'Lucie Moreau', email: 'lucie.moreau@example.test', phone: '06 11 22 33 02' },
      { name: 'Nicolas Martin', email: 'nicolas.martin@example.test', phone: '06 11 22 33 03' },
      { name: 'Sarah Petit', email: 'sarah.petit@example.test', phone: '06 11 22 33 04' },
      { name: 'Julien Robert', email: 'julien.robert@example.test', phone: '06 11 22 33 05' },
      { name: 'Manon Richard', email: 'manon.richard@example.test', phone: '06 11 22 33 06' },
      { name: 'Antoine Durand', email: 'antoine.durand@example.test', phone: '06 11 22 33 07' },
      { name: 'Élise Leroy', email: 'elise.leroy@example.test', phone: '06 11 22 33 08' },
      { name: 'Thomas Garnier', email: 'thomas.garnier@example.test', phone: '06 11 22 33 09' },
      { name: 'Inès Lefèvre', email: 'ines.lefevre@example.test', phone: '06 11 22 33 10' }
    ],
    locations: [
      {
        name: 'Domaine de la Haute Tour',
        address: '12 route des Remparts\n28000 Valombre',
        notes: 'Grande salle disponible, couchages limités.'
      },
      {
        name: 'Ancienne Abbaye de Sombreval',
        address: 'Chemin de l’Abbaye\n28120 Sombreval',
        notes: 'Ambiance forte, prévoir éclairage autonome.'
      }
    ],
    items: [
      {
        name: 'Testament scellé du baron',
        description: 'Document central de la succession, porteur de clauses contradictoires.',
        locationText: 'Coffre de la salle du conseil',
        characterNames: ['Aélis de Valombre'],
        intrigueNames: ['La succession du baron']
      },
      {
        name: 'Médaillon noirci',
        description: 'Bijou retrouvé après l’incendie de l’aile nord.',
        locationCharacterName: 'Sœur Ysilde',
        characterNames: [],
        intrigueNames: []
      }
    ]
  },
  {
    id: 'jeu-test-meridian',
    createStage: createMeridianStage,
    title: 'Station Meridian',
    description: 'Jeu d’essai : ce jeu n’aura jamais lieu. Une station scientifique coupée du reste du système solaire après la découverte d’un signal impossible.',
    noteIntention: 'Tester la paranoïa, la coopération sous pression et les dilemmes scientifiques.',
    characters: [
      { name: 'Dr Lena Kovacs', pitch: 'Directrice scientifique de Meridian, responsable du protocole de contact.' },
      { name: 'Milo Varga', pitch: 'Ingénieur de maintenance qui connaît les failles de la station.' },
      { name: 'Samira Okonkwo', pitch: 'Officière de sécurité chargée de maintenir le calme.' },
      { name: 'Eli Chen', pitch: 'Analyste signal, premier à avoir entendu la transmission.' },
      { name: 'Nadia Sol', pitch: 'Représentante du consortium privé financeur de la mission.' },
      { name: 'Jonas Pike', pitch: 'Médecin de bord, inquiet des effets psychologiques du signal.' },
      { name: 'Rhea Tan', pitch: 'Pilote de navette bloquée à quai depuis la panne orbitale.', type: 'pnj', trombinoscopeFaceHidden: true },
      { name: 'Oskar Nilsson', pitch: 'Technicien réseau soupçonné de falsifier les journaux système.', type: 'pnj', trombinoscopeDisplayName: 'Technicien inconnu' }
    ],
    factions: [
      {
        name: 'Équipe scientifique',
        pitch: 'Les spécialistes chargés de comprendre le signal sans provoquer de catastrophe.',
        characterNames: ['Dr Lena Kovacs', 'Eli Chen', 'Jonas Pike'],
        showInTrombinoscope: true
      },
      {
        name: 'Consortium Meridian',
        pitch: 'Les représentants des intérêts privés, techniques et sécuritaires de la station.',
        characterNames: ['Nadia Sol', 'Samira Okonkwo', 'Milo Varga']
      }
    ],
    intrigues: [
      {
        name: 'Le signal impossible',
        pitch: 'La station doit décider si le signal est une découverte, un piège ou une preuve de vie extraterrestre.',
        description: 'Chaque décision scientifique modifie le rapport de force entre sécurité, communication et exploitation privée.',
        level: 'main_story',
        characterNames: ['Dr Lena Kovacs', 'Eli Chen', 'Samira Okonkwo'],
        factionNames: ['Équipe scientifique']
      },
      {
        name: 'La responsabilité du protocole',
        pitch: 'Lena porte les conséquences d’un protocole qu’elle a elle-même défendu.',
        description: 'Cette trame personnelle pousse Lena à choisir entre transparence scientifique, protection de son équipe et pression du consortium.',
        level: 'main_character',
        characterNames: ['Dr Lena Kovacs', 'Nadia Sol'],
        factionNames: ['Consortium Meridian']
      },
      {
        name: 'Les journaux falsifiés',
        pitch: 'Des fichiers système ont été modifiés pendant la première réception du signal.',
        description: 'Les journaux techniques peuvent innocenter ou condamner plusieurs membres de l’équipage.',
        level: 'major',
        characterNames: ['Milo Varga', 'Oskar Nilsson', 'Rhea Tan'],
        factionNames: []
      },
      {
        name: 'Le message sans destinataire',
        pitch: 'Un message anonyme attend encore d’être rattaché à un personnage ou un groupe.',
        description: 'Intrigue volontairement non associée pour tester le signalement des intrigues orphelines.',
        level: 'minor',
        characterNames: [],
        factionNames: []
      }
    ],
    participants: [
      { name: 'Amandine Blanc', email: 'amandine.blanc@example.test', phone: '06 22 33 44 01' },
      { name: 'Mehdi Laurent', email: 'mehdi.laurent@example.test', phone: '06 22 33 44 02' },
      { name: 'Clara Rousseau', email: 'clara.rousseau@example.test', phone: '06 22 33 44 03' },
      { name: 'Hugo Fontaine', email: 'hugo.fontaine@example.test', phone: '06 22 33 44 04' },
      { name: 'Léa Mercier', email: 'lea.mercier@example.test', phone: '06 22 33 44 05' },
      { name: 'Raphaël Chevalier', email: 'raphael.chevalier@example.test', phone: '06 22 33 44 06' },
      { name: 'Nina Perrin', email: 'nina.perrin@example.test', phone: '06 22 33 44 07' },
      { name: 'Olivier Girard', email: 'olivier.girard@example.test', phone: '06 22 33 44 08' },
      { name: 'Maëlle Renaud', email: 'maelle.renaud@example.test', phone: '06 22 33 44 09' },
      { name: 'Baptiste Collet', email: 'baptiste.collet@example.test', phone: '06 22 33 44 10' },
      ...MERIDIAN_EXTRA_PEOPLE
    ],
    locations: [
      {
        name: 'Hangar 17',
        address: '17 avenue des Industries\n93200 Saint-Denis',
        notes: 'Grand volume, idéal pour décor science-fiction.'
      },
      {
        name: 'Laboratoire Atlas',
        address: '4 rue Newton\n91120 Palaiseau',
        notes: 'Plusieurs salles modulables et accès technique.'
      }
    ],
    items: [
      {
        name: 'Enregistreur du signal',
        description: 'Module de stockage contenant la première capture exploitable.',
        locationText: 'Baie technique B',
        characterNames: ['Dr Lena Kovacs', 'Eli Chen'],
        intrigueNames: ['Le signal impossible']
      },
      {
        name: 'Badge d’accès falsifié',
        description: 'Badge modifié donnant accès aux journaux système.',
        locationCharacterName: 'Oskar Nilsson',
        characterNames: ['Oskar Nilsson'],
        intrigueNames: ['Les journaux falsifiés']
      }
    ]
  },
  {
    id: 'jeu-test-bal',
    createStage: createBalStage,
    title: 'Le Bal des Masques Brisés',
    description: 'Une soirée mondaine où chaque invité cache une dette, une trahison ou une identité empruntée.',
    noteIntention: 'Favoriser le jeu social, les retournements publics et les révélations progressives.',
    characters: [
      { name: 'Céleste Vairon', pitch: 'Organisatrice du bal, officiellement ruinée mais toujours influente.' },
      { name: 'Octave Mirecourt', pitch: 'Critique mondain dont les chroniques peuvent détruire une réputation.' },
      { name: 'Iris de Montfaucon', pitch: 'Jeune aristocrate revenue d’exil avec un plan précis.' },
      { name: 'Valentin Sorel', pitch: 'Faussaire élégant qui prétend être collectionneur.' },
      { name: 'Agathe Lenoir', pitch: 'Duenna redoutable, mémoire vivante des scandales passés.' },
      { name: 'Romain Delmas', pitch: 'Banquier discret qui tient plusieurs invités par leurs dettes.' },
      { name: 'Mina Salvati', pitch: 'Chanteuse invitée, témoin d’une disparition ancienne.', type: 'pnj', trombinoscopeFaceHidden: true },
      { name: 'Gaspard Voss', pitch: 'Majordome impeccable, seul à circuler partout sans être vu.', type: 'pnj', trombinoscopeDisplayName: 'Personnel de maison' }
    ],
    factions: [
      {
        name: 'Les invités de marque',
        pitch: 'Les figures mondaines dont la réputation peut basculer au cours de la soirée.',
        characterNames: ['Céleste Vairon', 'Octave Mirecourt', 'Iris de Montfaucon'],
        showInTrombinoscope: true
      },
      {
        name: 'Les ombres du bal',
        pitch: 'Celles et ceux qui connaissent les secrets circulant derrière les sourires.',
        characterNames: ['Valentin Sorel', 'Mina Salvati', 'Gaspard Voss']
      }
    ],
    intrigues: [
      {
        name: 'Le scandale des masques',
        pitch: 'Le bal a été organisé pour révéler publiquement une trahison ancienne.',
        description: 'Les invités de marque savent qu’une révélation approche, mais ignorent qui sera frappé en premier.',
        level: 'main_story',
        characterNames: ['Céleste Vairon', 'Octave Mirecourt', 'Iris de Montfaucon'],
        factionNames: ['Les invités de marque']
      },
      {
        name: 'La collection falsifiée',
        pitch: 'Plusieurs pièces exposées pendant la soirée ne sont pas celles qu’elles prétendent être.',
        description: 'Cette intrigue relie dettes, faux documents et réputation mondaine.',
        level: 'major',
        characterNames: ['Valentin Sorel', 'Romain Delmas'],
        factionNames: ['Les ombres du bal']
      },
      {
        name: 'La chanson interrompue',
        pitch: 'Mina connaît les derniers mots d’une personne disparue lors d’un bal précédent.',
        description: 'Le souvenir de la chanteuse peut rouvrir une affaire que plusieurs invités croyaient enterrée.',
        level: 'minor',
        characterNames: ['Mina Salvati', 'Agathe Lenoir', 'Gaspard Voss'],
        factionNames: []
      },
      {
        name: 'Le billet non signé',
        pitch: 'Un billet compromettant a été retrouvé sans destinataire identifié.',
        description: 'Intrigue volontairement non associée pour tester le signalement des intrigues orphelines.',
        level: 'minor',
        characterNames: [],
        factionNames: []
      }
    ],
    participants: [
      { name: 'Pauline Aubert', email: 'pauline.aubert@example.test', phone: '06 33 44 55 01' },
      { name: 'Maxime Henry', email: 'maxime.henry@example.test', phone: '06 33 44 55 02' },
      { name: 'Chloé Renard', email: 'chloe.renard@example.test', phone: '06 33 44 55 03' },
      { name: 'Arthur Masson', email: 'arthur.masson@example.test', phone: '06 33 44 55 04' },
      { name: 'Eva Marchand', email: 'eva.marchand@example.test', phone: '06 33 44 55 05' },
      { name: 'Noé Caron', email: 'noe.caron@example.test', phone: '06 33 44 55 06' },
      { name: 'Jeanne Giraud', email: 'jeanne.giraud@example.test', phone: '06 33 44 55 07' },
      { name: 'Louis Lambert', email: 'louis.lambert@example.test', phone: '06 33 44 55 08' },
      { name: 'Anaïs Vidal', email: 'anais.vidal@example.test', phone: '06 33 44 55 09' },
      { name: 'Pierre Moulin', email: 'pierre.moulin@example.test', phone: '06 33 44 55 10' },
      ...BAL_EXTRA_PEOPLE
    ],
    locations: [
      {
        name: 'Hôtel des Verrières',
        address: '8 place du Théâtre\n54000 Nancy',
        notes: 'Salon principal lumineux, escalier central exploitable.'
      },
      {
        name: 'Maison Saint-Clair',
        address: '31 boulevard des Arts\n54000 Nancy',
        notes: 'Plus intimiste, parfait pour scènes de complot.'
      }
    ],
    items: [
      {
        name: 'Masque fendu',
        description: 'Masque décoratif portant une inscription cachée sous la dorure.',
        locationText: 'Vestiaire des invités',
        characterNames: ['Céleste Vairon'],
        intrigueNames: ['Le scandale des masques']
      },
      {
        name: 'Billet parfumé',
        description: 'Message court dont le destinataire reste à identifier.',
        locationText: 'Poche intérieure du manteau rouge',
        characterNames: [],
        intrigueNames: []
      }
    ]
  }
]

function makeSlug(value: string) {
  return slugify(value, { lower: true, strict: true })
}

const usedParticipantSlugs = new Set<string>()
// Fiches déjà créées dans ce rechargement, par adresse fictive : une personne n'en a qu'une pour les trois jeux (US-185)
const participantByEmail = new Map<string, { id: string, name: string, email: string | null }>()

async function makeParticipantSlug(name: string) {
  const baseSlug = makeSlug(name) || 'participant'
  let slug = baseSlug
  let suffix = 2

  while (
    usedParticipantSlugs.has(slug)
    || await db.participant.findUnique({ where: { slug }, select: { id: true } })
  ) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  usedParticipantSlugs.add(slug)
  return slug
}

async function createParticipantPhotos(gameId: string, participants: Array<{ id: string, name: string }>, gameIndex: number) {
  const photoDir = uploadDir(UPLOAD_DIRS.photos)
  await mkdir(photoDir, { recursive: true })

  const photos = new Map<string, string>()
  for (const [index, participant] of participants.entries()) {
    const filename = `seed-${gameIndex}-${makeSlug(participant.name)}.png`
    const content = createSeedPortraitPng(index + gameIndex * 17)
    // Lisible par le service, même quand le script est lancé par un autre compte du serveur
    await writeFile(join(photoDir, filename), content, { mode: 0o644 })
    const photoUrl = `${PHOTO_UPLOAD_PREFIX}${filename}`
    await db.uploadedFile.create({
      data: {
        kind: 'sessionAssignmentPhoto',
        filename,
        url: photoUrl,
        size: content.length,
        gameId
      }
    })
    photos.set(participant.id, photoUrl)
  }

  return photos
}

function createSeedPortraitPng(seed: number) {
  const width = 180
  const height = 240
  const palette: Array<[number, number, number]> = [
    [79, 70, 229],
    [14, 165, 233],
    [16, 185, 129],
    [245, 158, 11],
    [244, 63, 94],
    [139, 92, 246],
    [20, 184, 166],
    [249, 115, 22]
  ]
  const accent = palette[seed % palette.length]!
  const bg = palette[(seed + 3) % palette.length]!
  const data = Buffer.alloc((width * 4 + 1) * height)

  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    data[rowStart] = 0
    for (let x = 0; x < width; x++) {
      const offset = rowStart + 1 + x * 4
      const gradient = y / height
      let r = Math.round(bg[0] * (1 - gradient) + 248 * gradient)
      let g = Math.round(bg[1] * (1 - gradient) + 250 * gradient)
      let b = Math.round(bg[2] * (1 - gradient) + 252 * gradient)

      const face = ellipse(x, y, 90, 88, 40, 46)
      const body = ellipse(x, y, 90, 205, 62, 54)
      const hair = ellipse(x, y, 90, 72, 46, 30)

      if (body) {
        r = accent[0]
        g = accent[1]
        b = accent[2]
      }
      if (face) {
        r = 246
        g = 205 - (seed % 5) * 8
        b = 168 - (seed % 4) * 6
      }
      if (hair && y < 92) {
        r = 44 + (seed % 4) * 18
        g = 33 + (seed % 3) * 14
        b = 24 + (seed % 5) * 10
      }

      data[offset] = r
      data[offset + 1] = g
      data[offset + 2] = b
      data[offset + 3] = 255
    }
  }

  return encodePng(width, height, data)
}

function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1
}

function encodePng(width: number, height: number, rawData: Buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(rawData)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let index = 0; index < 8; index++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function defaultCharacterBackground(gameTitle: string, characterName: string, type: 'pj' | 'pnj') {
  const roleLabel = type === 'pnj' ? 'personnage non joueur' : 'personnage joueur'
  return `${characterName} est un ${roleLabel} de ${gameTitle}.

Son histoire personnelle contient des objectifs, des relations et des zones d’ombre à développer pendant l’écriture. Ce texte volontairement plus long permet de tester l’affichage des backgrounds, la génération des fiches personnage et les cas de relecture.`
}

function defaultCostumeIndications(type: 'pj' | 'pnj') {
  return type === 'pnj'
    ? 'Tenue identifiable mais modulable, accessoires faciles à retirer pour permettre plusieurs apparitions.'
    : 'Silhouette cohérente avec le statut social du personnage, avec un signe distinctif facile à reconnaître.'
}

function defaultTrombinoscopeNote(type: 'pj' | 'pnj') {
  return type === 'pnj'
    ? 'Peut apparaître ponctuellement pendant la session.'
    : ''
}

// Les jeux à remplacer, avec l'identifiant fixe de chacun. Rien n'est écrit tant que tout n'est pas vérifié.
async function findGamesToReplace(options: SeedOptions) {
  const fixedIdBySlug = new Map(games.map((game) => [makeSlug(game.title), game.id]))
  const fixedIds = games.map((game) => game.id)
  const slugs = [...fixedIdBySlug.keys()]

  const found = await db.game.findMany({
    where: { OR: [{ id: { in: fixedIds } }, { slug: { in: slugs } }] },
    select: { id: true, slug: true, title: true }
  })
  const fixedIdOf = new Map<string, string>()
  for (const game of found) {
    if (fixedIds.includes(game.id)) {
      fixedIdOf.set(game.id, game.id)
    } else if (options.replaceBySlug) {
      fixedIdOf.set(game.id, fixedIdBySlug.get(game.slug)!)
    } else {
      throw new Error(`L'adresse de page « ${game.slug} » est prise par un autre jeu (${game.title}) : rien n'a été modifié.`)
    }
  }
  return fixedIdOf
}

async function findOwner(options: SeedOptions) {
  if (!options.ownerEmail) {
    return await db.user.findFirst({
      where: { email: { notIn: TEST_ACCOUNTS.map((account) => account.email) } },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
      select: { id: true }
    })
  }
  const owner = await db.user.findUnique({ where: { email: options.ownerEmail }, select: { id: true } })
  if (!owner) {
    throw new Error('Aucun compte ne correspond à SEED_EMAIL : rien n\'a été modifié.')
  }
  return owner
}

async function preserveAccess(fixedIdOf: Map<string, string>): Promise<PreservedAccess[]> {
  const preserved = await db.game.findMany({
    where: { id: { in: [...fixedIdOf.keys()] } },
    select: {
      id: true,
      shares: { select: { userId: true, role: true } },
      aiAuthorizationGames: { select: { authorizationId: true } }
    }
  })
  return preserved.map((game) => ({
    gameId: fixedIdOf.get(game.id)!,
    shares: game.shares,
    aiAuthorizationIds: game.aiAuthorizationGames.map((link) => link.authorizationId)
  }))
}

async function restoreAccess(preserved: PreservedAccess[]) {
  for (const { gameId, shares, aiAuthorizationIds } of preserved) {
    for (const { userId, role } of shares) {
      await db.gameShare.upsert({
        where: { gameId_userId: { gameId, userId } },
        create: { gameId, userId, role },
        update: { role }
      })
    }
    await db.aiAuthorizationGame.createMany({
      data: aiAuthorizationIds.map((authorizationId) => ({ authorizationId, gameId })),
      skipDuplicates: true
    })
  }
}

// Supprime les jeux de test, leurs copies léguées encore en attente et les fiches qu'aucun autre jeu n'utilise.
// Une copie acceptée appartient à sa destinataire : elle reste. Rend les fichiers à retirer après la transaction.
async function removeGames(replacedIds: string[]) {
  const pendingCopies = await db.game.findMany({
    where: { copiedFromGameId: { in: replacedIds }, bequestPending: true },
    select: { id: true }
  })
  const gameIds = [...replacedIds, ...pendingCopies.map((game) => game.id)]

  const uploadUrls = (await Promise.all(gameIds.map((gameId) => collectUploadUrls({ gameId })))).flat()

  const outsideGames = { gameId: { notIn: gameIds } }
  await db.participant.deleteMany({
    where: {
      gameLinks: { some: { gameId: { in: gameIds } } },
      NOT: [
        { gameLinks: { some: outsideGames } },
        { sessionRoles: { some: { session: outsideGames } } },
        { registrations: { some: { period: outsideGames } } }
      ]
    }
  })
  await db.game.deleteMany({ where: { id: { in: gameIds } } })
  return uploadUrls
}

async function upsertTestAccounts(options: SeedOptions, password: string) {
  const now = new Date()
  for (const account of TEST_ACCOUNTS) {
    const email = personAddress(account.email, options.ownerEmail)
    const data = {
      name: account.name,
      password,
      role: 'user' as const,
      emailConfirmedAt: now,
      disabledAt: null,
      phone: account.phone,
      emergencyContactName: account.emergencyContactName,
      emergencyContactPhone: account.emergencyContactPhone,
      dietary: account.dietary,
      healthConsentAt: account.dietary ? now : null,
      profileUpdatedAt: now,
      termsAcceptedVersion: TERMS_VERSION,
      termsAcceptedAt: now,
      lastSeenAt: now
    }
    await db.user.upsert({
      where: { email },
      create: { email, ...data },
      // Mot de passe remis à neuf : les sessions ouvertes avec l'ancien se ferment
      update: { ...data, sessionVersion: { increment: 1 } }
    })
  }
}

// Le compte confirmé de chaque adresse de test, y compris quand ce lancement ne touche pas aux comptes
async function findTestAccounts(options: SeedOptions) {
  const accounts = await db.user.findMany({
    where: {
      email: { in: TEST_ACCOUNTS.map((account) => personAddress(account.email, options.ownerEmail)) },
      emailConfirmedAt: { not: null }
    },
    select: { id: true, email: true }
  })
  const idByAddress = new Map(accounts.map((account) => [account.email, account.id]))
  const accountIdByEmail = new Map<string, string>()
  for (const { email } of TEST_ACCOUNTS) {
    const id = idByAddress.get(personAddress(email, options.ownerEmail))
    if (id) accountIdByEmail.set(email, id)
  }
  return accountIdByEmail
}

async function createGame(
  seed: GameSeed,
  gameIndex: number,
  options: SeedOptions,
  accountIdByEmail: Map<string, string>,
  ownerId?: string
) {
  const inesAccountId = accountIdByEmail.get('ines.lefevre@example.test')
  const game = await db.game.create({
    data: {
      id: seed.id,
      title: seed.title,
      slug: makeSlug(seed.title),
      description: seed.description,
      noteIntention: seed.noteIntention,
      teaserUrl: '',
      published: true,
      ownerId,
      shares: inesAccountId && CO_ORGANIZED_GAME_IDS.includes(seed.id)
        ? { create: { userId: inesAccountId } }
        : undefined
    }
  })

  const characters = await Promise.all(seed.characters.map((character) =>
    db.character.create({
      data: {
        name: character.name,
        type: character.type || 'pj',
        slug: makeSlug(`${seed.title}-${character.name}`),
        pitch: character.pitch,
        background: character.background || defaultCharacterBackground(seed.title, character.name, character.type || 'pj'),
        costumeIndications: character.costumeIndications || defaultCostumeIndications(character.type || 'pj'),
        sheetReadyToSend: character.type !== 'pnj',
        excludeFromTrombinoscope: character.excludeFromTrombinoscope ?? false,
        trombinoscopeFaceHidden: character.trombinoscopeFaceHidden ?? false,
        trombinoscopeDisplayName: character.trombinoscopeDisplayName || null,
        trombinoscopeNote: character.trombinoscopeNote || defaultTrombinoscopeNote(character.type || 'pj'),
        gameId: game.id,
        published: true
      }
    })
  ))
  const characterByName = new Map(characters.map((character, index) => [seed.characters[index]!.name, character]))

  const factions = await Promise.all(seed.factions.map((faction) =>
    db.faction.create({
      data: {
        name: faction.name,
        slug: makeSlug(`${seed.title}-${faction.name}`),
        pitch: faction.pitch,
        showInTrombinoscope: faction.showInTrombinoscope ?? false,
        gameId: game.id,
        published: true,
        characterLinks: {
          create: faction.characterNames
            .flatMap((characterName) => {
              const character = characterByName.get(characterName)
              return character ? [{ characterId: character.id }] : []
            })
        }
      }
    })
  ))
  const factionByName = new Map(factions.map((faction, index) => [seed.factions[index]!.name, faction]))

  const intrigues = await Promise.all(seed.intrigues.map((intrigue) =>
    db.intrigue.create({
      data: {
        name: intrigue.name,
        slug: makeSlug(`${seed.title}-${intrigue.name}`),
        pitch: intrigue.pitch,
        description: intrigue.description,
        level: intrigue.level,
        gameId: game.id,
        published: true,
        characterLinks: {
          create: intrigue.characterNames
            .flatMap((characterName) => {
              const character = characterByName.get(characterName)
              return character ? [{ characterId: character.id }] : []
            })
        },
        factionLinks: {
          create: intrigue.factionNames
            .flatMap((factionName) => {
              const faction = factionByName.get(factionName)
              return faction ? [{ factionId: faction.id }] : []
            })
        }
      }
    })
  ))
  const intrigueByName = new Map(intrigues.map((intrigue, index) => [seed.intrigues[index]!.name, intrigue]))

  const participants: Array<{ id: string, name: string, email: string | null }> = []
  for (const participant of seed.participants) {
    // Une personne déjà présente dans un autre jeu de test garde sa fiche, qui reçoit ce jeu (US-185)
    const existing = participantByEmail.get(participant.email)
    if (existing) {
      await db.participantGame.create({ data: { participantId: existing.id, gameId: game.id, notes: participant.notes || null } })
      participants.push(existing)
      continue
    }
    const slug = await makeParticipantSlug(participant.name)
    participants.push(await db.participant.create({
      data: {
        name: participant.name,
        slug,
        email: personAddress(participant.email, options.ownerEmail),
        phone: participant.phone,
        userId: accountIdByEmail.get(participant.email) ?? null,
        gameLinks: {
          create: [{ gameId: game.id, notes: participant.notes || null }]
        },
        published: true
      }
    }))
    participantByEmail.set(participant.email, participants.at(-1)!)
  }
  const locations = await Promise.all(seed.locations.map((location) =>
    db.location.create({
      data: {
        name: location.name,
        slug: makeSlug(`${seed.title}-${location.name}`),
        address: location.address,
        notes: location.notes || null,
        gameId: game.id,
        published: true
      }
    })
  ))

  const items = await Promise.all(seed.items.map((item) => {
    const locationCharacter = item.locationCharacterName ? characterByName.get(item.locationCharacterName) : null

    return db.item.create({
      data: {
        name: item.name,
        slug: makeSlug(`${seed.title}-${item.name}`),
        description: item.description,
        quantity: 1,
        locationText: locationCharacter ? null : item.locationText || null,
        locationCharacterId: locationCharacter?.id || null,
        gameId: game.id,
        published: true,
        characterLinks: {
          create: item.characterNames
            .flatMap((characterName) => {
              const character = characterByName.get(characterName)
              return character ? [{ characterId: character.id }] : []
            })
        },
        intrigueLinks: {
          create: item.intrigueNames
            .flatMap((intrigueName) => {
              const intrigue = intrigueByName.get(intrigueName)
              return intrigue ? [{ intrigueId: intrigue.id }] : []
            })
        }
      }
    })
  }))

  await createTimelineEvents(game.id, seed.title, characters, factions, intrigues, items)
  await createDocuments(game.id, seed.title)
  await createTrombinoscopeEntries(game.id, characters)

  // Seules les personnes qui reçoivent un rôle ont une photo : 6 PJ et 2 PNJ (voir createSessions)
  const participantPhotos = await createParticipantPhotos(game.id, participants.filter((_, index) => index < 6 || index === 8 || index === 9), gameIndex)
  await createArchiveSession(game.id, seed.title, characters, participants, locations, participantPhotos)
  await seed.createStage(db, {
    gameId: game.id,
    title: seed.title,
    ownerId,
    locationId: locations[0]?.id,
    characters,
    photos: participantPhotos,
    people: new Map(seed.participants.map((participant, index) => [participant.email, participants[index]!])),
    profiles: new Map(TEST_ACCOUNTS.map((account) => [account.email, account])),
    makeSlug,
    address: (email) => personAddress(email, options.ownerEmail)
  })

  console.log(`${seed.title} : ${characters.length} personnages, ${participants.length} participants.`)

  return game
}

async function createDocuments(
  gameId: string,
  gameTitle: string
) {
  await db.document.createMany({
    data: [
      {
        title: `Feuille de route - ${gameTitle}`,
        slug: slugify(`Feuille de route - ${gameTitle}`, { lower: true, strict: true }),
        content: 'Adresse du lieu, horaires d’arrivée, consignes de stationnement, affaires à prévoir : serviette, gel douche, sac de couchage, vêtements chauds et gourde.',
        audiences: ['organizers', 'npcs', 'kitchen', 'pjs'],
        readyToSend: true,
        gameId,
        published: true
      },
      {
        title: `Document monde - ${gameTitle}`,
        slug: slugify(`Document monde - ${gameTitle}`, { lower: true, strict: true }),
        content: 'Présentation synthétique de l’univers, des conventions de jeu, des informations connues de tous et du niveau de transparence attendu.',
        audiences: ['organizers', 'npcs', 'kitchen', 'pjs'],
        readyToSend: true,
        gameId,
        published: true
      },
      {
        // Deux publics à la fois (US-187)
        title: `Règles de jeu - ${gameTitle}`,
        slug: slugify(`Règles de jeu - ${gameTitle}`, { lower: true, strict: true }),
        content: 'Mots de sécurité, gestion des combats, zones hors jeu et signes pour sortir d’une scène : ce que doivent connaître les PJ et les PNJ.',
        audiences: ['pjs', 'npcs'],
        readyToSend: true,
        gameId,
        published: true
      },
      {
        title: `Cadrage orga - ${gameTitle}`,
        slug: slugify(`Cadrage orga - ${gameTitle}`, { lower: true, strict: true }),
        content: 'Rappels logistiques internes, répartition des responsabilités, points de vigilance sécurité et contacts d’urgence.',
        audiences: ['organizers'],
        readyToSend: false,
        gameId,
        published: true
      },
      {
        title: `Instructions PNJs - ${gameTitle}`,
        slug: slugify(`Instructions PNJs - ${gameTitle}`, { lower: true, strict: true }),
        content: 'Consignes générales pour les PNJs, rythme des interventions, limites d’improvisation et coordination avec l’équipe d’organisation.',
        audiences: ['npcs'],
        readyToSend: false,
        gameId,
        published: true
      },
      {
        title: `Recettes cuisine - ${gameTitle}`,
        slug: slugify(`Recettes cuisine - ${gameTitle}`, { lower: true, strict: true }),
        content: 'Menus prévus, quantités par repas, contraintes alimentaires connues, plan de préparation et consignes de service pour l’équipe cuisine.',
        audiences: ['kitchen'],
        readyToSend: false,
        gameId,
        published: true
      }
    ]
  })
}

async function createTrombinoscopeEntries(gameId: string, characters: Array<{ id: string, type: string }>) {
  const pjCharacters = characters.filter((character) => character.type !== 'pnj')
  if (pjCharacters.length < 3) return

  await db.characterTrombinoscopeEntry.createMany({
    data: [
      {
        gameId,
        viewerCharacterId: pjCharacters[0]!.id,
        targetCharacterId: pjCharacters[1]!.id,
        included: true,
        faceKnown: true,
        displayName: 'Contact à confirmer',
        note: 'Le personnage pense reconnaître cette personne, sans certitude.'
      },
      {
        gameId,
        viewerCharacterId: pjCharacters[0]!.id,
        targetCharacterId: pjCharacters[2]!.id,
        included: true,
        faceKnown: false,
        note: 'Nom connu, visage inconnu au début de la session.'
      }
    ]
  })
}

async function createTimelineEvents(
  gameId: string,
  gameTitle: string,
  characters: Array<{ id: string, name: string, type: string }>,
  factions: Array<{ id: string, name: string }>,
  intrigues: Array<{ id: string, name: string }>,
  items: Array<{ id: string, name: string }>
) {
  const pjCharacters = characters.filter((character) => character.type !== 'pnj')
  const pnjCharacters = characters.filter((character) => character.type === 'pnj')

  const timelineSeeds = [
    {
      name: 'Briefing d’ouverture',
      description: 'Mise en place des informations initiales et lancement des premières dynamiques de jeu.',
      day: 1,
      time: '10:00',
      requiredResponsibles: 2,
      characterIds: pjCharacters.slice(0, 3).map((character) => character.id),
      factionIds: factions.slice(0, 1).map((faction) => faction.id),
      intrigueIds: intrigues.slice(0, 1).map((intrigue) => intrigue.id),
      itemIds: items.slice(0, 1).map((item) => item.id)
    },
    {
      name: 'Intervention secrète',
      description: 'Scène encadrée par l’organisation, prévue pour révéler une information sensible.',
      day: 1,
      time: '14:30',
      requiredResponsibles: 1,
      characterIds: [pjCharacters[0]?.id, pnjCharacters[0]?.id].filter((id): id is string => Boolean(id)),
      factionIds: [],
      intrigueIds: intrigues.slice(1, 2).map((intrigue) => intrigue.id),
      itemIds: items.slice(1, 2).map((item) => item.id)
    },
    {
      name: 'Incident concurrent',
      description: 'Événement volontairement placé au même créneau pour tester les alertes de conflit.',
      day: 1,
      time: '14:30',
      requiredResponsibles: 1,
      characterIds: pjCharacters.slice(0, 1).map((character) => character.id),
      factionIds: factions.slice(1, 2).map((faction) => faction.id),
      intrigueIds: intrigues.slice(2, 3).map((intrigue) => intrigue.id),
      itemIds: items.slice(1, 2).map((item) => item.id)
    },
    {
      name: 'Débriefing de fin de journée',
      description: 'Point logistique et préparation des relances du lendemain.',
      day: 1,
      time: '22:00',
      requiredResponsibles: 2,
      characterIds: pnjCharacters.slice(0, 2).map((character) => character.id),
      factionIds: [],
      intrigueIds: [],
      itemIds: []
    }
  ]

  await Promise.all(timelineSeeds.map((timelineEvent) =>
    db.timelineEvent.create({
      data: {
        name: timelineEvent.name,
        slug: makeSlug(`${gameTitle}-${timelineEvent.name}`),
        description: timelineEvent.description,
        day: timelineEvent.day,
        time: timelineEvent.time,
        requiredResponsibles: timelineEvent.requiredResponsibles,
        gameId,
        published: true,
        characterLinks: {
          create: timelineEvent.characterIds.map((id) => ({ characterId: id }))
        },
        factionLinks: {
          create: timelineEvent.factionIds.map((id) => ({ factionId: id }))
        },
        intrigueLinks: {
          create: timelineEvent.intrigueIds.map((id) => ({ intrigueId: id }))
        },
        itemLinks: {
          create: timelineEvent.itemIds.map((id) => ({ itemId: id }))
        }
      }
    })
  ))
}

async function createCrossGameParticipants(gameIds: string[]) {
  const alexMorganSlug = await makeParticipantSlug('Alex Morgan')
  await db.participant.create({
    data: {
      name: 'Alex Morgan',
      slug: alexMorganSlug,
      email: 'alex.morgan@example.test',
      phone: '06 44 55 66 01',
      gameLinks: {
        create: gameIds.slice(0, 2).map((gameId) => ({ gameId, notes: 'Inscrit sur plusieurs jeux, pour essayer les filtres.' }))
      },
      published: true
    }
  })

  const morganDaSilvaSlug = await makeParticipantSlug('Morgan Da Silva')
  await db.participant.create({
    data: {
      name: 'Morgan Da Silva',
      slug: morganDaSilvaSlug,
      email: 'morgan.dasilva@example.test',
      phone: '06 44 55 66 02',
      gameLinks: {
        create: gameIds.map((gameId) => ({ gameId, notes: 'Disponible sur tous les jeux de test.' }))
      },
      published: true
    }
  })
}

// La session terminée, commune aux trois jeux. Le reste vient de l'étape de chaque jeu.
async function createArchiveSession(
  gameId: string,
  gameTitle: string,
  characters: Array<{ id: string, name: string, type: string }>,
  participants: Array<{ id: string, name: string }>,
  locations: Array<{ id: string, name: string }>,
  participantPhotos: Map<string, string>
) {
  const pjCharacters = characters.filter((character) => character.type !== 'pnj')
  const pnjCharacters = characters.filter((character) => character.type === 'pnj')
  const organizer = participants[8]!
  const sessionPnj = participants[9]!
  const kitchen = participants[7]!

  const assignments = [
    ...pjCharacters.map((character, index) => ({ character, participant: participants[index]! })),
    ...pnjCharacters.map((character, index) => ({ character, participant: [organizer, sessionPnj][index]! }))
  ]
  const players = pjCharacters.map((_, index) => participants[index]!)

  await db.session.create({
    data: {
      name: `${gameTitle} - Session terminée`,
      slug: makeSlug(`${gameTitle}-session-terminee`),
      date: daysFromNow(-60),
      gameId,
      locationId: locations[0]?.id,
      status: 'completed',
      published: true,
      participants: {
        create: [
          { participantId: organizer.id, role: 'organizer' },
          { participantId: sessionPnj.id, role: 'npc' },
          { participantId: kitchen.id, role: 'kitchen' },
          ...players.map((player) => ({ participantId: player.id, role: 'participant' as const }))
        ]
      },
      assignments: {
        create: assignments.map(({ character, participant }) => ({
          characterId: character.id,
          participantId: participant.id,
          photoUrl: participantPhotos.get(participant.id) ?? null
        }))
      }
    }
  })
}

async function main() {
  const options = readSeedOptions(process.env)
  const password = options.password ? await hashPassword(options.password) : null

  const removedUploads = await prisma.$transaction(async (tx) => {
    db = tx
    // Tout se vérifie avant la première écriture
    const owner = await findOwner(options)
    const fixedIdOf = await findGamesToReplace(options)

    const preservedAccess = await preserveAccess(fixedIdOf)
    console.log('Suppression des anciens jeux de test...')
    const uploadUrls = await removeGames([...fixedIdOf.keys()])

    console.log('Création des jeux de test...')
    if (password) await upsertTestAccounts(options, password)
    const accountIdByEmail = await findTestAccounts(options)
    const createdGameIds: string[] = []
    for (const [index, game] of games.entries()) {
      const createdGame = await createGame(game, index, options, accountIdByEmail, owner?.id)
      createdGameIds.push(createdGame.id)
    }
    await createCrossGameParticipants(createdGameIds)
    for (const gameId of createdGameIds) await placePlayersInPool(db, gameId)
    await restoreAccess(preservedAccess)

    console.log(`${accountIdByEmail.size} compte(s) de test, ${preservedAccess.length} jeu(x) remplacé(s).`)
    return uploadUrls
  }, { timeout: RELOAD_TIMEOUT_MS })

  // Après la validation : les fichiers que les nouveaux jeux ne reprennent pas quittent le disque
  await deleteUnusedUploads(removedUploads)
  console.log('Jeux de test rechargés.')
}

main()
  .catch((error) => {
    console.error('Erreur lors du seed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
