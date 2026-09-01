import { describe, expect, it } from 'vitest'
import { fusuBeats } from './fusuStory'

describe('fusu historical pack', () => {
  it('contains a long-form, consistently labelled historical simulation', () => {
    expect(fusuBeats).toHaveLength(10)
    for (const beat of fusuBeats) {
      expect(beat.history.length).toBeGreaterThan(15)
      expect(beat.hypothesis.length).toBeGreaterThan(15)
      expect(beat.choices).toHaveLength(3)
    }
  })
})
