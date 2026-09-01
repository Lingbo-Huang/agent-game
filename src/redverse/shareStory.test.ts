import { describe, expect, it } from 'vitest'
import { buildSharedStoryResult, buildSharedStoryURL, decodeSharedStory } from './shareStory'
import { createStoryMemory } from './storyMemory'
import type { GeneratedStoryTurn } from './storyDirector'

describe('shared story continuation', () => {
  it('round-trips current node and authoritative choices without media or keys', () => {
    const memory = createStoryMemory({ sessionId: 'one', worldId: 'world', stageGoal: 'survive', currentLocation: 'room', canonConstraints: [], characters: [], items: [] })
    memory.events.push({ turn: 1, playerAction: 'open door', consequence: 'alarm', characterReactions: [], location: 'hall', itemChanges: [], actorName: 'Alice' })
    memory.turn = 1
    const chapter: GeneratedStoryTurn = { title: 'alarm', paragraphs: ['A long enough paragraph that records what visibly happened after the action.','A second paragraph keeps the chapter valid.'], characterReactions: [], suggestedActions: [], imagePrompts: [], newThread: 'who heard it' }
    const url = buildSharedStoryURL(memory, chapter, { href: 'https://example.test/play' } as Location)
    const decoded = decodeSharedStory(new URL(url).hash, 'world')
    expect(decoded?.memory.events[0].actorName).toBe('Alice')
    expect(decoded?.chapter.title).toBe('alarm')
    expect(url).not.toContain('data:image')
  })

  it('refuses an oversized browser snapshot instead of emitting a fragile URL', () => {
    const memory = createStoryMemory({ sessionId: 'large', worldId: 'world', stageGoal: 'survive', currentLocation: 'room', canonConstraints: [], characters: [], items: [] })
    memory.longTermSummary = Array.from({ length: 20 }, (_, index) => `${index}-${'很长的世界状态'.repeat(220)}`)
    const chapter: GeneratedStoryTurn = { title: 'large', paragraphs: ['足够长的第一段剧情，用于说明这一刻已经发生了什么。','足够长的第二段剧情，用于说明另一个角色怎样回应。'], characterReactions: [], suggestedActions: [], imagePrompts: [], newThread: '继续' }
    const result = buildSharedStoryResult(memory, chapter, { href: 'https://example.test/play' } as Location)
    expect(result.mode).toBe('too-large')
    expect(result.url).toBe('')
  })
})
