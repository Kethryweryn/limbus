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
}

type FactionSeed = {
  name: string
  pitch: string
  characterNames: string[]
}

type PlayerSeed = {
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

type GameSeed = {
  title: string
  description: string
  noteIntention: string
  characters: CharacterSeed[]
  factions: FactionSeed[]
  players: PlayerSeed[]
  locations: LocationSeed[]
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
      { name: 'Hélène de Briseciel', pitch: 'Diplomate venue négocier une paix impossible.' },
      { name: 'Toma le Rouge', pitch: 'Ancien contrebandier devenu informateur de la garde.' }
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
    players: [
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
      { name: 'Rhea Tan', pitch: 'Pilote de navette bloquée à quai depuis la panne orbitale.' },
      { name: 'Oskar Nilsson', pitch: 'Technicien réseau soupçonné de falsifier les journaux système.' }
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
    players: [
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
      { name: 'Mina Salvati', pitch: 'Chanteuse invitée, témoin d’une disparition ancienne.' },
      { name: 'Gaspard Voss', pitch: 'Majordome impeccable, seul à circuler partout sans être vu.' }
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
    players: [
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
    ]
  }
]

function makeSlug(value: string) {
  return slugify(value, { lower: true, strict: true })
}

async function clearBusinessData() {
  await prisma.sessionAssignment.deleteMany()
  await prisma.session.deleteMany()
  await prisma.player.deleteMany()
  await prisma.location.deleteMany()
  await prisma.document.deleteMany()
  await prisma.item.deleteMany()
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
        slug: makeSlug(`${seed.title}-${character.name}`),
        pitch: character.pitch,
        gameId: game.id,
        published: true
      }
    })
  ))
  const characterByName = new Map(characters.map((character, index) => [seed.characters[index].name, character]))

  await Promise.all(seed.factions.map((faction) =>
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

  const players = await Promise.all(seed.players.map((player) =>
    prisma.player.create({
      data: {
        name: player.name,
        email: player.email,
        phone: player.phone,
        notes: player.notes || null,
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

  await createSessions(game.id, seed.title, gameIndex, characters, players, locations)

  console.log(`${seed.title}: ${characters.length} personnages, ${seed.factions.length} groupes, ${players.length} joueurs, ${locations.length} lieux, 3 sessions`)

  return game
}

async function createCrossGamePlayers(gameIds: string[]) {
  await prisma.player.create({
    data: {
      name: 'Alex Morgan',
      email: 'alex.morgan@example.test',
      phone: '06 44 55 66 01',
      notes: 'Joueur inscrit sur plusieurs jeux pour tester les filtres.',
      gameLinks: {
        create: gameIds.slice(0, 2).map((gameId) => ({ gameId }))
      },
      published: true
    }
  })

  await prisma.player.create({
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
  characters: Array<{ id: string, name: string }>,
  players: Array<{ id: string, name: string }>,
  locations: Array<{ id: string, name: string }>
) {
  const pastDate = new Date(Date.UTC(2025, 5 + gameIndex, 7, 12, 0, 0))
  const firstDate = new Date(Date.UTC(2026, 8 + gameIndex, 12, 12, 0, 0))
  const secondDate = new Date(Date.UTC(2026, 9 + gameIndex, 3, 12, 0, 0))

  await prisma.session.create({
    data: {
      name: `${gameTitle} - Session archive`,
      date: pastDate,
      gameId,
      locationId: locations[0]?.id,
      status: 'completed',
      published: true,
      assignments: {
        create: characters.map((character, index) => ({
          characterId: character.id,
          playerId: players[index]?.id || null,
          notes: index === 0 ? 'Session passée complète utilisée pour tester les statistiques.' : null
        }))
      }
    }
  })

  await prisma.session.create({
    data: {
      name: `${gameTitle} - Session alpha`,
      date: firstDate,
      gameId,
      locationId: locations[0]?.id,
      status: 'scheduled',
      published: true,
      assignments: {
        create: characters.slice(0, 6).map((character, index) => ({
          characterId: character.id,
          playerId: players[index]?.id || null,
          notes: index % 3 === 0 ? 'Brief joueur à vérifier avant impression.' : null
        }))
      }
    }
  })

  await prisma.session.create({
    data: {
      name: `${gameTitle} - Session beta`,
      date: secondDate,
      gameId,
      locationId: locations[1]?.id,
      status: 'postponed',
      published: true,
      assignments: {
        create: characters.slice(2, 8).map((character, index) => ({
          characterId: character.id,
          playerId: players[index + 3]?.id || null,
          notes: index === 1 ? 'Photo à reprendre le jour du jeu.' : null
        }))
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
  await createCrossGamePlayers(createdGameIds)

  console.log('Seed terminé.')
}

main()
  .catch((error) => {
    console.error('Erreur lors du seed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
