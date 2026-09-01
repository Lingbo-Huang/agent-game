export interface StoryCharacterContext {
  id: string
  principles: string[]
  goal: string
  emotion: string
  knownFacts: string[]
}

export interface StoryTurnContext {
  worldId: string
  turn: number
  playerAction: string
  currentLocation: string
  stageGoal: string
  canonConstraints: string[]
  allowedLocations: string[]
  inventory: string[]
  itemStates: Array<{ id: string; name: string; holder: string; status: string; purpose: string }>
  recentEvents: string[]
  longTermSummary: string[]
  unresolvedThreads: string[]
  threadStates: Array<{ id: string; summary: string }>
  characters: StoryCharacterContext[]
}

export interface GeneratedStoryTurn {
  title: string
  paragraphs: string[]
  characterReactions: Array<{ characterId: string; publicText: string; intent: string }>
  suggestedActions: Array<{ id: string; title: string; intent: string }>
  imagePrompts: string[]
  newThread: string
  stateDelta?: {
    location?: string
    itemChanges?: Array<{ itemId: string; holder?: string; status?: string; purpose?: string }>
    resolvedThreadIds?: string[]
  }
}

export type StoryTurnGenerationResult =
  | { chapter: GeneratedStoryTurn; mode: 'ai' }
  | { chapter: null; mode: 'fallback'; reason: string }

function text(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max
}

/** Client-side Director gate. The server already validates the model response;
 * this second boundary prevents malformed or stale payloads from entering UI state. */
export interface StoryTurnAuthority {
  characterIds: string[]
  itemIds?: string[]
  threadIds?: string[]
  locations?: string[]
}

export function parseGeneratedStoryTurn(value: unknown, authority: string[] | StoryTurnAuthority): GeneratedStoryTurn | null {
  const allowedCharacterIds = Array.isArray(authority) ? authority : authority.characterIds
  if (!value || typeof value !== 'object') return null
  const chapter = value as Record<string, unknown>
  if (!text(chapter.title, 2, 60) || !Array.isArray(chapter.paragraphs) || chapter.paragraphs.length < 2 || chapter.paragraphs.length > 4 || !chapter.paragraphs.every((item) => text(item, 30, 1000))) return null
  if (!Array.isArray(chapter.characterReactions) || !chapter.characterReactions.every((item) => {
    if (!item || typeof item !== 'object') return false
    const reaction = item as Record<string, unknown>
    return typeof reaction.characterId === 'string' && allowedCharacterIds.includes(reaction.characterId) && text(reaction.publicText, 2, 240)
  })) return null
  if (!Array.isArray(chapter.suggestedActions) || chapter.suggestedActions.length < 2 || chapter.suggestedActions.length > 4 || !chapter.suggestedActions.every((item) => {
    if (!item || typeof item !== 'object') return false
    const action = item as Record<string, unknown>
    return text(action.id, 1, 80) && text(action.title, 1, 40) && text(action.intent, 2, 160)
  })) return null
  if (!Array.isArray(chapter.imagePrompts) || chapter.imagePrompts.length > 2 || !chapter.imagePrompts.every((item) => text(item, 10, 500))) return null
  if (chapter.stateDelta !== undefined) {
    if (!chapter.stateDelta || typeof chapter.stateDelta !== 'object') return null
    const delta = chapter.stateDelta as Record<string, unknown>
    if (delta.location !== undefined && !text(delta.location, 1, 100)) return null
    if (!Array.isArray(authority) && delta.location !== undefined && authority.locations?.length && !authority.locations.includes(delta.location as string)) return null
    if (delta.itemChanges !== undefined && (!Array.isArray(delta.itemChanges) || delta.itemChanges.length > 8 || !delta.itemChanges.every((item) => {
      if (!item || typeof item !== 'object') return false
      const change = item as Record<string, unknown>
      return text(change.itemId, 1, 80) && (Array.isArray(authority) || authority.itemIds === undefined || authority.itemIds.includes(change.itemId)) && ['holder', 'status', 'purpose'].some((key) => change[key] !== undefined) && ['holder', 'status', 'purpose'].every((key) => change[key] === undefined || text(change[key], 1, 160))
    }))) return null
    if (delta.resolvedThreadIds !== undefined && (!Array.isArray(delta.resolvedThreadIds) || !delta.resolvedThreadIds.every((id) => text(id, 1, 100)))) return null
    if (!Array.isArray(authority) && Array.isArray(delta.resolvedThreadIds) && authority.threadIds !== undefined && delta.resolvedThreadIds.some((id) => !authority.threadIds?.includes(id as string))) return null
  }
  // Narrative prose should not be discarded just because the model omitted a
  // piece of UI metadata. The server has already validated the authoritative
  // ids and state delta; fill harmless presentation fields here instead of
  // replacing a specific chapter with a generic fallback.
  return {
    ...(chapter as unknown as GeneratedStoryTurn),
    newThread: text(chapter.newThread, 2, 240) ? chapter.newThread : '本章行动的长期后果仍在扩散。',
    characterReactions: (chapter.characterReactions as Array<Record<string, unknown>>).map((reaction) => ({
      characterId: reaction.characterId as string,
      publicText: reaction.publicText as string,
      intent: text(reaction.intent, 2, 160) ? reaction.intent : '按自己掌握的信息与目标判断局势',
    })),
  }
}

export async function generateStoryTurn(context: StoryTurnContext, signal?: AbortSignal): Promise<StoryTurnGenerationResult> {
  const timeout = new AbortController()
  // A provider's first full structured chapter may arrive in 20–28 seconds.
  // Aborting at 18 seconds made a healthy online Director look broken and
  // forced every turn into the authored fallback.
  // Stay below the server's 35 second ceiling while allowing real chapters.
  const timeoutId = window.setTimeout(() => timeout.abort(), 33_000)
  const abortFromCaller = () => timeout.abort()
  signal?.addEventListener('abort', abortFromCaller, { once: true })
  try {
    const response = await fetch('/api/story-turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(context), signal: timeout.signal })
    if (!response.ok) return { chapter: null, mode: 'fallback', reason: `在线续章暂时不可用（${response.status}）` }
    const parsed = parseGeneratedStoryTurn(await response.json(), {
      characterIds: context.characters.map((character) => character.id),
      itemIds: context.itemStates.map((item) => item.id),
      threadIds: context.threadStates.map((thread) => thread.id),
      locations: context.allowedLocations,
    })
    return parsed
      ? { chapter: parsed, mode: 'ai' }
      : { chapter: null, mode: 'fallback', reason: '模型已返回，但章节结构未通过世界规则校验' }
  } catch (error) {
    return { chapter: null, mode: 'fallback', reason: error instanceof Error && error.name === 'AbortError' ? (signal?.aborted ? '在线续章已取消' : '在线续章响应较慢') : '网络中断，已切换可靠剧情' }
  } finally {
    window.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}
