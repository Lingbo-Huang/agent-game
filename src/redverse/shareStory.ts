import type { GeneratedStoryTurn } from './storyDirector'
import type { StoryMemory } from './storyMemory'

export interface SharedStorySnapshot {
  version: 1
  worldId: string
  sharedAt: string
  memory: StoryMemory
  chapter: GeneratedStoryTurn
}

export type SharedStoryBuildResult =
  | { mode: 'snapshot'; url: string; size: number }
  | { mode: 'too-large'; url: ''; size: number }

export const MAX_SHARE_URL_LENGTH = 24_000

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

export function encodeSharedStory(memory: StoryMemory, chapter: GeneratedStoryTurn) {
  const snapshot: SharedStorySnapshot = { version: 1, worldId: memory.worldId, sharedAt: new Date().toISOString(), memory, chapter }
  return toBase64Url(JSON.stringify(snapshot))
}

export function decodeSharedStory(hash: string, expectedWorldId: string): SharedStorySnapshot | null {
  try {
    const encoded = new URLSearchParams(hash.replace(/^#/, '')).get('continue')
    if (!encoded || encoded.length > 120_000) return null
    const snapshot = JSON.parse(fromBase64Url(encoded)) as SharedStorySnapshot
    if (snapshot.version !== 1 || snapshot.worldId !== expectedWorldId || snapshot.memory.worldId !== expectedWorldId || !Array.isArray(snapshot.memory.events) || !Array.isArray(snapshot.chapter.paragraphs)) return null
    return snapshot
  } catch { return null }
}

export function buildSharedStoryURL(memory: StoryMemory, chapter: GeneratedStoryTurn, location = window.location) {
  const url = new URL(location.href)
  url.hash = `continue=${encodeSharedStory(memory, chapter)}`
  return url.toString()
}

/** Browser snapshots are an explicit temporary transport, not a server share.
 * Refuse oversized URLs instead of producing a link that browsers, chat apps or
 * gateways silently truncate. The UI can then explain the limitation rather
 * than pretending a durable cross-device branch was created. */
export function buildSharedStoryResult(memory: StoryMemory, chapter: GeneratedStoryTurn, location = window.location): SharedStoryBuildResult {
  const url = buildSharedStoryURL(memory, chapter, location)
  return url.length <= MAX_SHARE_URL_LENGTH
    ? { mode: 'snapshot', url, size: url.length }
    : { mode: 'too-large', url: '', size: url.length }
}
