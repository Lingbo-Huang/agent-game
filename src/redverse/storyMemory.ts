import type { StoryCharacterContext, StoryTurnContext } from './storyDirector'

export type StoryThreadStatus = 'open' | 'resolved' | 'abandoned'

export interface StoryItemState {
  id: string
  name: string
  origin: string
  holder: string
  status: string
  purpose: string
  introducedTurn: number
  lastChangedTurn: number
}

export interface StoryThreadState {
  id: string
  summary: string
  status: StoryThreadStatus
  introducedTurn: number
  resolvedTurn?: number
}

export interface StoryEvent {
  turn: number
  playerAction: string
  consequence: string
  characterReactions: string[]
  location: string
  itemChanges: string[]
  itemStateChanges?: Array<{ itemId: string; holder?: string; status?: string; purpose?: string }>
  resolvedThreadIds?: string[]
  openedThread?: string
  actorName?: string
}

export interface StoryMemory {
  version: 1
  sessionId: string
  worldId: string
  turn: number
  stageGoal: string
  currentLocation: string
  allowedLocations?: string[]
  canonConstraints: string[]
  characters: StoryCharacterContext[]
  items: StoryItemState[]
  threads: StoryThreadState[]
  events: StoryEvent[]
  longTermSummary: string[]
}

const PREFIX = 'redverse:story-memory:'
const ACTIVE_PREFIX = 'redverse:active-story-session:'

function clean(value: string, max = 500) { return value.replace(/\s+/g, ' ').trim().slice(0, max) }

export function createStoryMemory(input: Omit<StoryMemory, 'version' | 'turn' | 'events' | 'threads' | 'longTermSummary'>): StoryMemory {
  return { ...input, version: 1, turn: 0, events: [], threads: [], longTermSummary: [] }
}

/** Append only after the Director/Critic has approved the turn. Generated prose
 * is not authoritative; this event contains the small set of facts that the
 * world engine actually committed. */
export function commitStoryEvent(memory: StoryMemory, event: StoryEvent): StoryMemory {
  if (event.turn !== memory.turn + 1) throw new Error('story event is out of order')
  const committed: StoryEvent = {
    ...event,
    playerAction: clean(event.playerAction),
    consequence: clean(event.consequence, 800),
    characterReactions: event.characterReactions.map((item) => clean(item, 300)).slice(0, 6),
    itemChanges: event.itemChanges.map((item) => clean(item, 240)).slice(0, 8),
    openedThread: event.openedThread ? clean(event.openedThread, 240) : undefined,
    actorName: event.actorName ? clean(event.actorName, 80) : undefined,
  }
  const events = [...memory.events, committed]
  const threads = committed.openedThread
    ? [...memory.threads, { id: `thread-${event.turn}`, summary: committed.openedThread, status: 'open' as const, introducedTurn: event.turn }]
    : memory.threads
  const resolved = new Set(committed.resolvedThreadIds || [])
  const nextThreads = threads.map((thread) => resolved.has(thread.id) ? { ...thread, status: 'resolved' as const, resolvedTurn: event.turn } : thread)
  const byItem = new Map((committed.itemStateChanges || []).map((change) => [change.itemId, change]))
  const items = memory.items.map((item) => {
    const change = byItem.get(item.id)
    return change ? { ...item, holder: clean(change.holder || item.holder, 100), status: clean(change.status || item.status, 160), purpose: clean(change.purpose || item.purpose, 160), lastChangedTurn: event.turn } : item
  })
  // Keep detailed prose for five turns. Older history is reduced to factual
  // one-line commitments so context stays focused as a session grows.
  const compacted = events.length > 5 ? events.slice(0, -5).map((old) => `第${old.turn}回合：玩家${old.playerAction}；结果：${old.consequence}`) : []
  return {
    ...memory,
    turn: event.turn,
    currentLocation: event.location,
    // Keep the full playable branch for the UI/share flow. Model context is
    // trimmed separately below, so a ten-chapter story remains reviewable
    // without sending an ever-growing prompt to the Director.
    events: events.slice(-20),
    threads: nextThreads,
    items,
    longTermSummary: [...memory.longTermSummary, ...compacted].slice(-20),
  }
}

export function resolveStoryThread(memory: StoryMemory, id: string, turn: number): StoryMemory {
  return { ...memory, threads: memory.threads.map((thread) => thread.id === id ? { ...thread, status: 'resolved', resolvedTurn: turn } : thread) }
}

export function buildStoryTurnContext(memory: StoryMemory, playerAction: string): StoryTurnContext {
  return {
    worldId: memory.worldId,
    turn: memory.turn + 1,
    playerAction: clean(playerAction, 600),
    currentLocation: memory.currentLocation,
    stageGoal: memory.stageGoal,
    canonConstraints: memory.canonConstraints,
    allowedLocations: memory.allowedLocations?.length ? memory.allowedLocations : [memory.currentLocation],
    inventory: memory.items.map((item) => `${item.id}｜${item.name}｜来源:${item.origin}｜持有人:${item.holder}｜状态:${item.status}｜用途:${item.purpose}`),
    itemStates: memory.items.map(({ id, name, holder, status, purpose }) => ({ id, name, holder, status, purpose })),
    recentEvents: memory.events.slice(-5).map((event) => `第${event.turn}回合 玩家:${event.playerAction}；后果:${event.consequence}；物件:${event.itemChanges.join('、') || '无变化'}`),
    longTermSummary: memory.longTermSummary,
    unresolvedThreads: memory.threads.filter((thread) => thread.status === 'open').map((thread) => thread.summary),
    threadStates: memory.threads.filter((thread) => thread.status === 'open').map(({ id, summary }) => ({ id, summary })),
    characters: memory.characters,
  }
}

export function saveStoryMemory(memory: StoryMemory, storage: Storage = window.sessionStorage) {
  storage.setItem(`${PREFIX}${memory.sessionId}`, JSON.stringify(memory))
}

export function loadStoryMemory(sessionId: string, storage: Storage = window.sessionStorage): StoryMemory | null {
  try {
    const raw = storage.getItem(`${PREFIX}${sessionId}`)
    if (!raw) return null
    const value = JSON.parse(raw) as StoryMemory
    if (value.version !== 1 || value.sessionId !== sessionId || !Array.isArray(value.events) || !Array.isArray(value.items)) return null
    return value
  } catch { return null }
}

export function clearStoryMemory(sessionId: string, storage: Storage = window.sessionStorage) {
  storage.removeItem(`${PREFIX}${sessionId}`)
}

/** Keep one resumable story per world inside the current browser tab. Closing
 * the tab clears both the pointer and its privacy-sensitive story snapshot. */
export function getActiveStorySessionId(worldId: string, storage: Storage = window.sessionStorage): string {
  const key = `${ACTIVE_PREFIX}${clean(worldId, 80)}`
  const existing = storage.getItem(key)
  if (existing) return existing
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const sessionId = `${clean(worldId, 80)}-${randomId}`
  storage.setItem(key, sessionId)
  return sessionId
}
