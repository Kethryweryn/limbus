import { lookup } from 'node:dns/promises'
import { BlockList, isIPv4 } from 'node:net'
import { isHttpUrl } from '~/utils/urls'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 5000

// Adresses internes : le serveur ne doit jamais aller les interroger pour le compte d'un organisateur
const privateRanges = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]
] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv6')
}

export function isPrivateAddress(address: string) {
  const mappedV4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1]
  if (mappedV4) return privateRanges.check(mappedV4, 'ipv4')
  return privateRanges.check(address, isIPv4(address) ? 'ipv4' : 'ipv6')
}

/**
 * Télécharge une photo externe pour l'intégrer à un PDF : http(s) seulement, hôte public,
 * sans redirection, 5 s et 5 Mo au plus. Renvoie null en cas de refus ou d'échec.
 * Limite connue : un DNS qui change de réponse entre la vérification et la requête n'est pas couvert.
 */
export async function fetchPublicImage(url: string): Promise<Buffer | null> {
  if (!isHttpUrl(url)) return null

  try {
    const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '')
    const addresses = await lookup(hostname, { all: true })
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) return null

    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok || !response.body) return null
    if (Number(response.headers.get('content-length') || 0) > MAX_IMAGE_BYTES) return null

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.length
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(chunk.value)
    }
    return Buffer.concat(chunks)
  } catch {
    return null
  }
}
