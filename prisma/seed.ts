import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { fakerFR as faker } from '@faker-js/faker'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
}

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: databaseUrl
    })
})

async function main() {
    console.log('🧹 Suppression des anciennes données...')
    await prisma.character.deleteMany()
    await prisma.game.deleteMany()

    console.log('🌱 Insertion de nouveaux jeux et personnages...')

    for (let i = 0; i < 10; i++) {
        const title = faker.lorem.words(3)
        const game = await prisma.game.create({
            data: {
                title,
                slug: faker.helpers.slugify(title.toLowerCase()),
                description: faker.lorem.paragraph(),
                noteIntention: faker.lorem.sentences(1),
                teaserUrl: ''
            }
        })

        for (let j = 0; j < 20; j++) {
            await prisma.character.create({
                data: {
                    name: faker.person.fullName(),
                    description: faker.lorem.paragraph(),
                    slug: `${game.id}-char-${j + 1}`,
                    gameId: game.id
                }
            })
        }

        console.log(`✅ ${game.title} : 20 personnages créés`)
    }

    console.log('🎉 Seed terminé.')
}

main()
    .catch((e) => {
        console.error('❌ Erreur lors du seed :', e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
