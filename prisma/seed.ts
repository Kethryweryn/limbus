import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import slugify from 'slugify'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl
  })
})

type CharacterSeed = {
  name: string
  pitch: string
  type?: 'pj' | 'pnj'
}

type FactionSeed = {
  name: string
  pitch: string
  characterNames: string[]
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

const games: GameSeed[] = [
  {
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
      { name: 'Hélène de Briseciel', pitch: 'Diplomate venue négocier une paix impossible.', type: 'pnj' },
      { name: 'Toma le Rouge', pitch: 'Ancien contrebandier devenu informateur de la garde.', type: 'pnj' }
    ],
    factions: [
      {
        name: 'La Maison de Valombre',
        pitch: 'Le cercle noble qui tente de préserver la légitimité de la succession.',
        characterNames: ['Aélis de Valombre', 'Hélène de Briseciel']
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
    title: 'Station Meridian',
    description: 'Une station scientifique coupée du reste du système solaire après la découverte d’un signal impossible.',
    noteIntention: 'Tester la paranoïa, la coopération sous pression et les dilemmes scientifiques.',
    characters: [
      { name: 'Dr Lena Kovacs', pitch: 'Directrice scientifique de Meridian, responsable du protocole de contact.' },
      { name: 'Milo Varga', pitch: 'Ingénieur de maintenance qui connaît les failles de la station.' },
      { name: 'Samira Okonkwo', pitch: 'Officière de sécurité chargée de maintenir le calme.' },
      { name: 'Eli Chen', pitch: 'Analyste signal, premier à avoir entendu la transmission.' },
      { name: 'Nadia Sol', pitch: 'Représentante du consortium privé financeur de la mission.' },
      { name: 'Jonas Pike', pitch: 'Médecin de bord, inquiet des effets psychologiques du signal.' },
      { name: 'Rhea Tan', pitch: 'Pilote de navette bloquée à quai depuis la panne orbitale.', type: 'pnj' },
      { name: 'Oskar Nilsson', pitch: 'Technicien réseau soupçonné de falsifier les journaux système.', type: 'pnj' }
    ],
    factions: [
      {
        name: 'Équipe scientifique',
        pitch: 'Les spécialistes chargés de comprendre le signal sans provoquer de catastrophe.',
        characterNames: ['Dr Lena Kovacs', 'Eli Chen', 'Jonas Pike']
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
      { name: 'Baptiste Collet', email: 'baptiste.collet@example.test', phone: '06 22 33 44 10' }
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
      { name: 'Mina Salvati', pitch: 'Chanteuse invitée, témoin d’une disparition ancienne.', type: 'pnj' },
      { name: 'Gaspard Voss', pitch: 'Majordome impeccable, seul à circuler partout sans être vu.', type: 'pnj' }
    ],
    factions: [
      {
        name: 'Les invités de marque',
        pitch: 'Les figures mondaines dont la réputation peut basculer au cours de la soirée.',
        characterNames: ['Céleste Vairon', 'Octave Mirecourt', 'Iris de Montfaucon']
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
      { name: 'Pierre Moulin', email: 'pierre.moulin@example.test', phone: '06 33 44 55 10' }
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

async function clearBusinessData() {
  await prisma.timelineEventResponsible.deleteMany()
  await prisma.sessionAssignment.deleteMany()
  await prisma.session.deleteMany()
  await prisma.timelineEvent.deleteMany()
  await prisma.item.deleteMany()
  await prisma.participant.deleteMany()
  await prisma.location.deleteMany()
  await prisma.document.deleteMany()
  await prisma.intrigue.deleteMany()
  await prisma.faction.deleteMany()
  await prisma.character.deleteMany()
  await prisma.game.deleteMany()
}

async function createGame(seed: GameSeed, gameIndex: number) {
  const game = await prisma.game.create({
    data: {
      title: seed.title,
      slug: makeSlug(seed.title),
      description: seed.description,
      noteIntention: seed.noteIntention,
      teaserUrl: '',
      published: true
    }
  })

  const characters = await Promise.all(seed.characters.map((character) =>
    prisma.character.create({
      data: {
        name: character.name,
        type: character.type || 'pj',
        slug: makeSlug(`${seed.title}-${character.name}`),
        pitch: character.pitch,
        gameId: game.id,
        published: true
      }
    })
  ))
  const characterByName = new Map(characters.map((character, index) => [seed.characters[index].name, character]))

  const factions = await Promise.all(seed.factions.map((faction) =>
    prisma.faction.create({
      data: {
        name: faction.name,
        slug: makeSlug(`${seed.title}-${faction.name}`),
        pitch: faction.pitch,
        gameId: game.id,
        published: true,
        characters: {
          connect: faction.characterNames
            .flatMap((characterName) => {
              const character = characterByName.get(characterName)
              return character ? [{ id: character.id }] : []
            })
        }
      }
    })
  ))
  const factionByName = new Map(factions.map((faction, index) => [seed.factions[index].name, faction]))

  const intrigues = await Promise.all(seed.intrigues.map((intrigue) =>
    prisma.intrigue.create({
      data: {
        name: intrigue.name,
        slug: makeSlug(`${seed.title}-${intrigue.name}`),
        pitch: intrigue.pitch,
        description: intrigue.description,
        level: intrigue.level,
        gameId: game.id,
        published: true,
        characters: {
          connect: intrigue.characterNames
            .flatMap((characterName) => {
              const character = characterByName.get(characterName)
              return character ? [{ id: character.id }] : []
            })
        },
        factions: {
          connect: intrigue.factionNames
            .flatMap((factionName) => {
              const faction = factionByName.get(factionName)
              return faction ? [{ id: faction.id }] : []
            })
        }
      }
    })
  ))
  const intrigueByName = new Map(intrigues.map((intrigue, index) => [seed.intrigues[index].name, intrigue]))

  const participants = await Promise.all(seed.participants.map((participant) =>
    prisma.participant.create({
      data: {
        name: participant.name,
        email: participant.email,
        phone: participant.phone,
        notes: participant.notes || null,
        gameLinks: {
          create: [{ gameId: game.id }]
        },
        published: true
      }
    })
  ))
  const locations = await Promise.all(seed.locations.map((location) =>
    prisma.location.create({
      data: {
        name: location.name,
        address: location.address,
        notes: location.notes || null,
        gameId: game.id,
        published: true
      }
    })
  ))

  const items = await Promise.all(seed.items.map((item) => {
    const locationCharacter = item.locationCharacterName ? characterByName.get(item.locationCharacterName) : null

    return prisma.item.create({
      data: {
        name: item.name,
        description: item.description,
        quantity: 1,
        locationText: locationCharacter ? null : item.locationText || null,
        locationCharacterId: locationCharacter?.id || null,
        gameId: game.id,
        published: true,
        characters: {
          connect: item.characterNames
            .flatMap((characterName) => {
              const character = characterByName.get(characterName)
              return character ? [{ id: character.id }] : []
            })
        },
        intrigues: {
          connect: item.intrigueNames
            .flatMap((intrigueName) => {
              const intrigue = intrigueByName.get(intrigueName)
              return intrigue ? [{ id: intrigue.id }] : []
            })
        }
      }
    })
  }))

  await createTimelineEvents(game.id, characters, factions, intrigues, items)

  await createSessions(game.id, seed.title, gameIndex, characters, participants, locations)

  console.log(`${seed.title}: ${characters.length} personnages, ${seed.factions.length} groupes, ${seed.intrigues.length} intrigues, ${seed.items.length} objets, ${participants.length} participants, ${locations.length} lieux, 3 sessions`)

  return game
}

async function createTimelineEvents(
  gameId: string,
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
    prisma.timelineEvent.create({
      data: {
        name: timelineEvent.name,
        description: timelineEvent.description,
        day: timelineEvent.day,
        time: timelineEvent.time,
        requiredResponsibles: timelineEvent.requiredResponsibles,
        gameId,
        published: true,
        characters: {
          connect: timelineEvent.characterIds.map((id) => ({ id }))
        },
        factions: {
          connect: timelineEvent.factionIds.map((id) => ({ id }))
        },
        intrigues: {
          connect: timelineEvent.intrigueIds.map((id) => ({ id }))
        },
        items: {
          connect: timelineEvent.itemIds.map((id) => ({ id }))
        }
      }
    })
  ))
}

async function createCrossGameParticipants(gameIds: string[]) {
  await prisma.participant.create({
    data: {
      name: 'Alex Morgan',
      email: 'alex.morgan@example.test',
      phone: '06 44 55 66 01',
      notes: 'participant inscrit sur plusieurs jeux pour tester les filtres.',
      gameLinks: {
        create: gameIds.slice(0, 2).map((gameId) => ({ gameId }))
      },
      published: true
    }
  })

  await prisma.participant.create({
    data: {
      name: 'Morgan Da Silva',
      email: 'morgan.dasilva@example.test',
      phone: '06 44 55 66 02',
      notes: 'Disponible sur tous les jeux de test.',
      gameLinks: {
        create: gameIds.map((gameId) => ({ gameId }))
      },
      published: true
    }
  })
}

async function createSessions(
  gameId: string,
  gameTitle: string,
  gameIndex: number,
  characters: Array<{ id: string, name: string, type: string }>,
  participants: Array<{ id: string, name: string }>,
  locations: Array<{ id: string, name: string }>
) {
  const pastDate = new Date(Date.UTC(2025, 5 + gameIndex, 7, 12, 0, 0))
  const firstDate = new Date(Date.UTC(2026, 8 + gameIndex, 12, 12, 0, 0))
  const secondDate = new Date(Date.UTC(2026, 9 + gameIndex, 3, 12, 0, 0))
  const pjCharacters = characters.filter((character) => character.type !== 'pnj')
  const pnjCharacters = characters.filter((character) => character.type === 'pnj')
  const organizer = participants[8]
  const sessionPnj = participants[9]
  const fixedSessionRoles = [
    organizer ? { participantId: organizer.id, role: 'organizer' } : null,
    sessionPnj ? { participantId: sessionPnj.id, role: 'npc' } : null
  ].filter((role): role is { participantId: string, role: string } => Boolean(role))

  const sessionParticipantsFor = (
    assignments: Array<{ character: { type: string }, participantId: string | null }>,
    fixedRoles = fixedSessionRoles
  ) => {
    const roles = new Map<string, { participantId: string, role: string }>()
    for (const role of fixedRoles) {
      roles.set(`${role.participantId}:${role.role}`, role)
    }

    for (const assignment of assignments) {
      if (!assignment.participantId) continue

      const hasSessionRole = fixedRoles.some((role) => role.participantId === assignment.participantId)
      if (hasSessionRole) continue

      const role = assignment.character.type === 'pnj' ? 'npc' : 'participant'
      roles.set(`${assignment.participantId}:${role}`, { participantId: assignment.participantId, role })
    }
    return [...roles.values()]
  }

  const buildAssignments = (assignedPjCount: number, assignedPnjCount: number) => [
    ...pjCharacters.map((character, index) => ({
      character,
      characterId: character.id,
      participantId: index < assignedPjCount ? participants[index]?.id || null : null,
      notes: index === 0 ? 'Brief participant à vérifier avant impression.' : null
    })),
    ...pnjCharacters.map((character, index) => ({
      character,
      characterId: character.id,
      participantId: index < assignedPnjCount
        ? [organizer?.id, sessionPnj?.id][index] || null
        : null,
      notes: index === 0 ? 'Rôle PNJ attribué à l’équipe de session.' : null
    }))
  ]

  const pastAssignments = buildAssignments(pjCharacters.length, pnjCharacters.length).map((assignment, index) => ({
    ...assignment,
    notes: index === 0 ? 'Session passée complète utilisée pour tester les statistiques.' : assignment.notes
  }))

  await prisma.session.create({
    data: {
      name: `${gameTitle} - Session archive`,
      date: pastDate,
      gameId,
      locationId: locations[0]?.id,
      status: 'completed',
      published: true,
      participants: {
        create: sessionParticipantsFor(pastAssignments)
      },
      assignments: {
        create: pastAssignments.map(({ character, ...assignment }) => assignment)
      }
    }
  })

  const firstAssignments = buildAssignments(Math.max(0, pjCharacters.length - 2), 1)

  await prisma.session.create({
    data: {
      name: `${gameTitle} - Session alpha`,
      date: firstDate,
      gameId,
      locationId: locations[0]?.id,
      status: 'scheduled',
      published: true,
      participants: {
        create: sessionParticipantsFor(firstAssignments)
      },
      assignments: {
        create: firstAssignments.map(({ character, ...assignment }) => assignment)
      }
    }
  })

  const secondAssignments = buildAssignments(Math.max(0, pjCharacters.length - 1), 0)

  await prisma.session.create({
    data: {
      name: `${gameTitle} - Session beta`,
      date: secondDate,
      gameId,
      locationId: locations[1]?.id,
      status: 'postponed',
      published: true,
      participants: {
        create: sessionParticipantsFor(secondAssignments)
      },
      assignments: {
        create: secondAssignments.map(({ character, ...assignment }) => assignment)
      }
    }
  })
}

async function main() {
  console.log('Suppression des anciennes données métier...')
  await clearBusinessData()

  console.log('Création du jeu de données de test...')
  const createdGameIds: string[] = []
  for (const [index, game] of games.entries()) {
    const createdGame = await createGame(game, index)
    createdGameIds.push(createdGame.id)
  }
  await createCrossGameParticipants(createdGameIds)

  console.log('Seed terminé.')
}

main()
  .catch((error) => {
    console.error('Erreur lors du seed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
