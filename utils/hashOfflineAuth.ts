export async function signOfflineAuth(payload: object, secret: string): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )

    const data = encoder.encode(JSON.stringify(payload))
    const signature = await crypto.subtle.sign('HMAC', key, data)
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
}
