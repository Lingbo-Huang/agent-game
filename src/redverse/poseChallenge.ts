import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export interface GuardEvaluation {
  score: number
  visible: boolean
  matched: boolean
  hint: string
}

function visibility(point: NormalizedLandmark | undefined) {
  return point?.visibility ?? 0
}

/**
 * “架挡”动作：双手腕抬至肩部以上，手肘也离开躯干，并保持身体正面可见。
 * 全部使用身体比例归一化，和玩家离摄像头远近无关。
 */
export function evaluateGuardPose(points: NormalizedLandmark[]): GuardEvaluation {
  const leftShoulder = points[11]
  const rightShoulder = points[12]
  const leftElbow = points[13]
  const rightElbow = points[14]
  const leftWrist = points[15]
  const rightWrist = points[16]
  const required = [leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist]
  const visible = required.every((point) => visibility(point) >= .55)
  if (!visible) return { score: 0, visible: false, matched: false, hint: '请后退半步，让肩膀、手肘和手腕都进入画面' }

  const shoulderWidth = Math.max(.08, Math.abs(rightShoulder.x - leftShoulder.x))
  const wristsRaised = leftWrist.y < leftShoulder.y + .04 && rightWrist.y < rightShoulder.y + .04
  const elbowsRaised = leftElbow.y < leftShoulder.y + shoulderWidth * .7 && rightElbow.y < rightShoulder.y + shoulderWidth * .7
  const leftSpread = Math.abs(leftWrist.x - leftShoulder.x) > shoulderWidth * .18
  const rightSpread = Math.abs(rightWrist.x - rightShoulder.x) > shoulderWidth * .18

  let score = 18
  if (wristsRaised) score += 44
  if (elbowsRaised) score += 24
  if (leftSpread && rightSpread) score += 14
  const matched = wristsRaised && elbowsRaised && leftSpread && rightSpread
  return {
    score: Math.min(100, score),
    visible: true,
    matched,
    hint: matched ? '架挡姿势稳定，继续保持！' : !wristsRaised ? '把双手抬到肩膀以上' : !elbowsRaised ? '把手肘抬起，不要贴住身体' : '双手再向两侧展开一些',
  }
}

export const UPPER_BODY_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
]
