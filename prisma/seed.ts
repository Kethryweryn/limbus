import { PrismaClient } from '@prisma/client'
import { fakerFR as faker } from '@faker-js/faker'

const prisma = new PrismaClient()

async function main() {
    console.log('🧹 Suppression des anciennes données...')
    await prisma.character.deleteMany()
    await prisma.game.deleteMany()

    console.log('🌱 Insertion de nouveaux jeux et personnages...')

    for (let i = 0; i < 10; i++) {
        const game = await prisma.game.create({
            data: {
                title: faker.lorem.words(3),
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
