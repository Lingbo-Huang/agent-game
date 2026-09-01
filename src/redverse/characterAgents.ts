import { npcs } from './content'
import type { CharacterAction, NpcId, PlayerAction, WorldState } from './types'
import { getWorldAgentBrief, type CompiledWorld } from './worldCompiler'

const kinds = new Set<CharacterAction['kind']>(['review', 'withdraw', 'disclose', 'observe', 'stay', 'relocate'])

export function validateRemoteCharacterActions(value: unknown, state: WorldState): CharacterAction[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Record<string, unknown>
    const npcId = raw.npcId as NpcId
    if (!npcs[npcId] || seen.has(npcId) || typeof raw.kind !== 'string' || !kinds.has(raw.kind as CharacterAction['kind'])) return []
    if (typeof raw.intent !== 'string' || typeof raw.reason !== 'string' || typeof raw.publicText !== 'string') return []
    if (!raw.intent.trim() || !raw.reason.trim() || !raw.publicText.trim() || raw.publicText.length > 180) return []
    seen.add(npcId)
    const proposal: CharacterAction = {
      npcId,
      kind: raw.kind as CharacterAction['kind'],
      intent: raw.intent,
      reason: raw.reason,
      fromLocationId: state.npcStates[npcId].currentLocationId,
      publicText: raw.publicText,
      performance: { emotion: 'curious', pose: 'turn', emphasis: raw.emphasis === 'strong' ? 'strong' : raw.emphasis === 'quiet' ? 'quiet' : 'normal' },
    }
    return [proposal]
  }).slice(0, 2)
}

export interface CharacterAgentResponse {
  actions: CharacterAction[]
  mode: 'parallel-per-character' | 'unknown'
  agentsConsulted: number
}

export async function requestCharacterActions(state: WorldState, action: PlayerAction, world?: CompiledWorld): Promise<CharacterAgentResponse> {
  const response = await fetch('/api/character-proposals', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      turn: state.currentTurn, actionType: action.type, targetId: action.targetId || '',
      theme: world?.themeId,
      characters: Object.values(npcs).map((npc) => ({
        id: npc.id,
        name: world ? getWorldAgentBrief(world, npc.id).name : npc.name,
        principles: world ? [getWorldAgentBrief(world, npc.id).principle] : npc.immutablePrinciples,
        goal: world ? getWorldAgentBrief(world, npc.id).goal : state.npcStates[npc.id].currentGoal,
        emotion: state.npcStates[npc.id].emotion, knownFacts: state.npcStates[npc.id].knownFacts,
      })),
    }),
  })
  if (!response.ok) return { actions: [], mode: 'unknown', agentsConsulted: 0 }
  const data = await response.json() as { actions?: unknown; mode?: unknown; agentsConsulted?: unknown }
  return {
    actions: validateRemoteCharacterActions(data.actions, state),
    mode: data.mode === 'parallel-per-character' ? data.mode : 'unknown',
    agentsConsulted: typeof data.agentsConsulted === 'number' ? data.agentsConsulted : 0,
  }
}
