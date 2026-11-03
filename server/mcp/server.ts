import type { H3Event } from 'h3'
import { McpServer } from '@modelcontextprotocol/server'
import { registerGameTools } from '~/server/mcp/games'
import { registerContentTools } from '~/server/mcp/content'
import { registerSessionTools } from '~/server/mcp/sessions'
import { registerParticipantTools } from '~/server/mcp/participants'
import { registerRegistrationTools } from '~/server/mcp/registrations'
import { registerContentWriteTools } from '~/server/mcp/contentWrites'
import { registerSessionAndParticipantWriteTools } from '~/server/mcp/sessionWrites'

const INSTRUCTIONS = [
  'Limbus est un outil d’organisation de jeux de rôle grandeur nature (GN).',
  'Commencez par lister_jeux : seuls les jeux autorisés par l’organisatrice sont visibles.',
  'Les données des participants sont limitées à leur nom et aux notes d’organisation ; aucune coordonnée ni réponse libre n’est accessible.'
].join(' ')

/** Serveur MCP d'une requête (US-122) : ses outils agissent avec le compte et l'autorisation posés sur l'événement. */
export function buildLimbusMcpServer(event: H3Event) {
  const server = new McpServer({ name: 'limbus', title: 'Limbus', version: '1.0.0' }, { instructions: INSTRUCTIONS })
  const context = { event, server }
  registerGameTools(context)
  registerContentTools(context)
  registerSessionTools(context)
  registerParticipantTools(context)
  registerRegistrationTools(context)
  registerContentWriteTools(context)
  registerSessionAndParticipantWriteTools(context)
  return server
}
