import { describe, expect, it } from 'vitest'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { evaluateGuardPose } from './poseChallenge'

function pose(overrides: Record<number, Partial<NormalizedLandmark>> = {}) {
  const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: 1 }))
  Object.entries(overrides).forEach(([index, value]) => Object.assign(points[Number(index)], value))
  return points
}

describe('evaluateGuardPose', () => {
  it('recognizes a two-arm defensive guard', () => {
    const result = evaluateGuardPose(pose({
      11: { x: .4, y: .45 }, 12: { x: .6, y: .45 },
      13: { x: .32, y: .36 }, 14: { x: .68, y: .36 },
      15: { x: .25, y: .25 }, 16: { x: .75, y: .25 },
    }))
    expect(result.matched).toBe(true)
    expect(result.score).toBe(100)
  })

  it('rejects hidden or lowered wrists', () => {
    const hidden = pose({ 15: { visibility: .2 } })
    expect(evaluateGuardPose(hidden).visible).toBe(false)
    const lowered = pose({
      11: { x: .4, y: .4 }, 12: { x: .6, y: .4 }, 13: { x: .3, y: .55 }, 14: { x: .7, y: .55 }, 15: { x: .2, y: .7 }, 16: { x: .8, y: .7 },
    })
    expect(evaluateGuardPose(lowered).matched).toBe(false)
  })
})
