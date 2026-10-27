import type { H3Event } from 'h3'

// Événement H3 minimal : en-têtes de requête, adresse du pair, en-têtes de réponse enregistrés.
export function fakeEvent(options: { remoteAddress?: string, headers?: Record<string, string> } = {}) {
  const responseHeaders: Record<string, string> = {}
  const event = {
    node: {
      req: {
        headers: Object.fromEntries(Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value])),
        socket: { remoteAddress: options.remoteAddress ?? '127.0.0.1' }
      },
      res: {
        setHeader: (name: string, value: string) => { responseHeaders[name.toLowerCase()] = value },
        getHeader: (name: string) => responseHeaders[name.toLowerCase()]
      }
    },
    context: {}
  }

  return { event: event as unknown as H3Event, responseHeaders }
}
