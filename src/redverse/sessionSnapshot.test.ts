import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialWorldState } from './content'
import { clearMirrorSession, loadMirrorSession, saveMirrorSession } from './sessionSnapshot'

describe('temporary mirror session snapshot', () => {
  beforeEach(() => sessionStorage.clear())

  it('restores a versioned snapshot after refresh', () => {
    const state = createInitialWorldState()
    state.currentTurn = 2
    state.processedActionIds.push('turn-2-action')
    saveMirrorSession({ source: '一次测试困惑', screen: 'game', state })
    expect(loadMirrorSession()).toMatchObject({ schemaVersion: 1, source: '一次测试困惑', screen: 'game', state: { currentTurn: 2, processedActionIds: ['turn-2-action'] } })
  })

  it('can be explicitly cleared and ignores corrupt data', () => {
    saveMirrorSession({ source: 'test', screen: 'reflection', state: createInitialWorldState() })
    clearMirrorSession()
    expect(loadMirrorSession()).toBeUndefined()
    sessionStorage.setItem('redverse:mirror-session:v1', '{broken')
    expect(loadMirrorSession()).toBeUndefined()
  })
})
