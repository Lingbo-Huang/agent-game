import { describe, expect, it } from 'vitest'
import { detectiveBeats } from './detectiveStory'

describe('original detective pack', () => {
  it('offers eight decisions and states every evidence boundary', () => {
    expect(detectiveBeats).toHaveLength(8)
    for (const beat of detectiveBeats) {
      expect(beat.choices).toHaveLength(3)
      expect(beat.evidence).not.toBe(beat.cannotProve)
      expect(beat.cannotProve).toMatch(/不能|不等于|无法|不解释/)
    }
  })
})
