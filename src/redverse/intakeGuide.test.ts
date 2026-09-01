import { describe, expect, it } from 'vitest'
import { buildIntakeQuestions, composeGuidedStory } from './intakeGuide'

describe('guided story intake', () => {
  it('asks at most three short questions and covers missing stakes', () => {
    const questions = buildIntakeQuestions('同事抢了我的功劳')
    expect(questions).toHaveLength(3)
    expect(questions.some((item) => item.lens === 'stakes')).toBe(true)
  })

  it('keeps the original story and labels optional answers', () => {
    expect(composeGuidedStory('发生了一件事', { unknown: '我不知道他是不是故意的' })).toContain('留一块未知：我不知道他是不是故意的')
  })
})
