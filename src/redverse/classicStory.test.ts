import { describe, expect, it } from 'vitest'
import { classicBeats } from './classicStory'

describe('classic story pack', () => {
  it('contains a long-form 10-20 decision experience', () => {
    expect(classicBeats.length).toBeGreaterThanOrEqual(10)
    expect(classicBeats.length).toBeLessThanOrEqual(20)
  })
  it('separates canon, interpretation and what-if choices at every beat', () => {
    for (const beat of classicBeats) {
      expect(beat.canon.length).toBeGreaterThan(10)
      expect(beat.interpretation.length).toBeGreaterThan(10)
      expect(beat.speaker.length).toBeGreaterThan(0)
      expect(beat.choices).toHaveLength(3)
      expect(new Set(beat.choices.map((choice) => choice.id)).size).toBe(3)
    }
  })
})
