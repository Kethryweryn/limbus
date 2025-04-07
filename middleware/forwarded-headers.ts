export default defineEventHandler((event) => {
    const forwarded = getHeader(event, 'x-forwarded-host')
    if (forwarded) {
        event.req.headers.host = forwarded
    }
})
