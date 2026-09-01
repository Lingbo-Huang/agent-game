import type { StoryAction, StoryState } from '../types'

export const demoStory = '孩子今天想加入其他小朋友的游戏，但被拒绝了。回来以后一直说，再也不要和他们玩。'

export const initialStoryState: StoryState = {
  step: 'setup',
  parentStory: demoStory,
  learningGoal: '说出自己的需要',
  ageBand: '7-9',
  parentConfirmed: false,
  hasSeenPerspective: false,
  rewindCount: 0,
}

export function storyReducer(state: StoryState, action: StoryAction): StoryState {
  switch (action.type) {
    case 'UPDATE_SETUP':
      return { ...state, ...action }
    case 'START':
      return state.step === 'setup' && state.parentConfirmed && state.parentStory.trim() ? { ...state, step: 'cover' } : state
    case 'OPEN_BOOK':
      return state.step === 'cover' ? { ...state, step: 'emotion' } : state
    case 'CHOOSE_EMOTION':
      return state.step === 'emotion' ? { ...state, emotion: action.emotion } : state
    case 'CHOOSE_COMPANION':
      return state.step === 'companions' ? { ...state, companion: action.companion } : state
    case 'SEE_PERSPECTIVE':
      return state.step === 'perspective' ? { ...state, hasSeenPerspective: true } : state
    case 'CHOOSE_SENTENCE':
      return state.step === 'sentence' ? { ...state, sentence: action.sentence } : state
    case 'CONTINUE':
      if (state.step === 'emotion' && state.emotion) return { ...state, step: 'companions' }
      if (state.step === 'companions' && state.companion) return { ...state, step: 'perspective' }
      if (state.step === 'perspective' && state.hasSeenPerspective) return { ...state, step: 'sentence' }
      if (state.step === 'sentence' && state.sentence) return { ...state, step: 'outcome' }
      if (state.step === 'outcome') return { ...state, step: 'card' }
      return state
    case 'REWIND':
      return state.step === 'outcome' || state.step === 'card'
        ? { ...state, step: 'sentence', sentence: undefined, rewindCount: state.rewindCount + 1 }
        : state
    case 'RESTART':
      return { ...initialStoryState }
  }
}
