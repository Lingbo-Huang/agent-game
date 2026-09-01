export type StoryStep = 'setup' | 'cover' | 'emotion' | 'companions' | 'perspective' | 'sentence' | 'outcome' | 'card'

export type EmotionId = 'rain' | 'fire' | 'stone' | 'wind'
export type CompanionId = 'chongchong' | 'manman' | 'tingting'
export type SentenceId = 'join' | 'boundary' | 'leave'
export type AgeBand = '4-6' | '7-9' | '10-12'

export interface StoryState {
  step: StoryStep
  parentStory: string
  learningGoal: string
  ageBand: AgeBand
  parentConfirmed: boolean
  emotion?: EmotionId
  companion?: CompanionId
  hasSeenPerspective: boolean
  sentence?: SentenceId
  rewindCount: number
}

export type StoryAction =
  | { type: 'UPDATE_SETUP'; parentStory?: string; learningGoal?: string; ageBand?: AgeBand; parentConfirmed?: boolean }
  | { type: 'START' }
  | { type: 'OPEN_BOOK' }
  | { type: 'CHOOSE_EMOTION'; emotion: EmotionId }
  | { type: 'CHOOSE_COMPANION'; companion: CompanionId }
  | { type: 'SEE_PERSPECTIVE' }
  | { type: 'CHOOSE_SENTENCE'; sentence: SentenceId }
  | { type: 'CONTINUE' }
  | { type: 'REWIND' }
  | { type: 'RESTART' }
