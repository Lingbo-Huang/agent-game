import { describe, expect, it } from 'vitest'
import { initialStoryState, storyReducer } from './storyMachine'

describe('storyReducer', () => {
  it('follows the golden path and blocks incomplete pages', () => {
    expect(storyReducer(initialStoryState, { type: 'START' }).step).toBe('setup')
    let state = storyReducer({ ...initialStoryState, parentConfirmed: true }, { type: 'START' })
    state = storyReducer(state, { type: 'OPEN_BOOK' })
    expect(storyReducer(state, { type: 'CONTINUE' }).step).toBe('emotion')

    state = storyReducer(state, { type: 'CHOOSE_EMOTION', emotion: 'rain' })
    state = storyReducer(state, { type: 'CONTINUE' })
    expect(state.step).toBe('companions')
  })

  it('rewinds from the ending and clears only the sentence', () => {
    const state = storyReducer(
      { ...initialStoryState, step: 'card', emotion: 'rain', sentence: 'join', hasSeenPerspective: true },
      { type: 'REWIND' },
    )
    expect(state.step).toBe('sentence')
    expect(state.sentence).toBeUndefined()
    expect(state.emotion).toBe('rain')
    expect(state.rewindCount).toBe(1)
  })

  it('ignores actions that do not belong to the current page', () => {
    expect(storyReducer(initialStoryState, { type: 'OPEN_BOOK' })).toEqual(initialStoryState)
  })

  it('requires an adult gate before entering the child story', () => {
    expect(storyReducer(initialStoryState, { type: 'START' }).step).toBe('setup')
    expect(storyReducer({ ...initialStoryState, parentConfirmed: true }, { type: 'START' }).step).toBe('cover')
  })
})
