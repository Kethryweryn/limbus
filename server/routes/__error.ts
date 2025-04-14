export default defineEventHandler((event) => {
    const query = getQuery(event)

    const statusCode = parseInt(query.statusCode as string) || 500
    const statusMessage = typeof query.statusMessage === 'string' ? query.statusMessage : 'Erreur'
    const message = typeof query.message === 'string' ? query.message : 'Une erreur est survenue.'

    // ✅ on ignore complètement `data` pour éviter les problèmes de serialisation
    return {
        url: query.url,
        statusCode,
        statusMessage,
        message,
    }
})
