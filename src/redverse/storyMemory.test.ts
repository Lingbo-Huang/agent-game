import { describe, expect, it } from 'vitest'
import { buildStoryTurnContext, clearStoryMemory, commitStoryEvent, createStoryMemory, getActiveStorySessionId, loadStoryMemory, saveStoryMemory } from './storyMemory'

function initial() {
  return createStoryMemory({
    sessionId: 'demo', worldId: 'fusu', stageGoal: '核验异常诏书', currentLocation: '上郡营帐',
    canonConstraints: ['扶苏不知道沙丘发生了什么'],
    characters: [{ id: 'mengtian', principles: ['不拿边军做无证据的豪赌'], goal: '保护边军并复核诏书', emotion: '警觉', knownFacts: ['诏书催促立即执行'] }],
    items: [{ id: 'seal', name: '异常封泥', origin: '咸阳来使', holder: '扶苏', status: '边缘破损', purpose: '与驿传副本比对', introducedTurn: 0, lastChangedTurn: 0 }],
  })
}

describe('story memory', () => {
  it('builds focused context from authority state instead of raw transcript', () => {
    const memory = commitStoryEvent(initial(), { turn: 1, playerAction: '让蒙恬验封泥', consequence: '蒙恬发现封泥边缘被重新加热', characterReactions: ['蒙恬要求查驿传'], location: '中军大帐', itemChanges: ['异常封泥：疑似二次封缄'], openedThread: '谁重新封过诏书？' })
    const context = buildStoryTurnContext(memory, '去驿站查上一站记录')
    expect(context.inventory.join('')).toContain('来源:咸阳来使')
    expect(context.recentEvents.join('')).toContain('二次封缄')
    expect(context.unresolvedThreads).toContain('谁重新封过诏书？')
    expect(context.itemStates[0]).toMatchObject({ id: 'seal', holder: '扶苏' })
    expect(context.threadStates[0]).toMatchObject({ id: 'thread-1' })
  })

  it('commits validated item state changes instead of remembering only prose', () => {
    const memory = commitStoryEvent(initial(), { turn: 1, playerAction: '交给蒙恬验封', consequence: '封泥被交给蒙恬', characterReactions: [], location: '中军大帐', itemChanges: ['异常封泥转交蒙恬'], itemStateChanges: [{ itemId: 'seal', holder: '蒙恬', status: '正在比对' }] })
    expect(memory.items[0].holder).toBe('蒙恬')
    expect(buildStoryTurnContext(memory, '继续').inventory.join('')).toContain('状态:正在比对')
  })

  it('rejects out-of-order facts', () => {
    expect(() => commitStoryEvent(initial(), { turn: 2, playerAction: '跳过', consequence: '错误', characterReactions: [], location: '营帐', itemChanges: [] })).toThrow(/out of order/)
  })

  it('persists only inside the provided session storage', () => {
    const storage = window.sessionStorage
    saveStoryMemory(initial(), storage)
    expect(loadStoryMemory('demo', storage)?.worldId).toBe('fusu')
    clearStoryMemory('demo', storage)
    expect(loadStoryMemory('demo', storage)).toBeNull()
  })

  it('reuses an active session id so a refresh can load the same memory', () => {
    const storage = window.sessionStorage
    storage.clear()
    const first = getActiveStorySessionId('fusu', storage)
    expect(getActiveStorySessionId('fusu', storage)).toBe(first)
    const memory = { ...initial(), sessionId: first }
    saveStoryMemory(memory, storage)
    expect(loadStoryMemory(getActiveStorySessionId('fusu', storage), storage)?.worldId).toBe('fusu')
  })

  it('keeps a reviewable branch while sending only the five newest events to the Director', () => {
    let memory = initial()
    for (let turn = 1; turn <= 10; turn += 1) {
      memory = commitStoryEvent(memory, {
        turn,
        playerAction: `action-${turn}`,
        consequence: `consequence-${turn}`,
        characterReactions: [],
        location: '上郡营帐',
        itemChanges: [],
      })
    }
    expect(memory.events).toHaveLength(10)
    const context = buildStoryTurnContext(memory, '继续')
    expect(context.recentEvents).toHaveLength(5)
    expect(context.recentEvents[0]).toContain('action-6')
    expect(context.recentEvents.at(-1)).toContain('action-10')
  })
})
