import { describe, expect, it } from 'vitest'
import { decideSafetyRoute } from './safety'

describe('safety routing', () => {
  it('keeps ordinary conflict in the story route', () => {
    expect(decideSafetyRoute('同事抢了我的功劳，我不知道要不要说', 'mirror').route).toBe('story')
  })

  it('routes immediate self-harm language away from gameplay', () => {
    expect(decideSafetyRoute('我现在想死，不想活了', 'mirror')).toMatchObject({ route: 'urgent-support' })
  })

  it('asks children to remove identifying details', () => {
    expect(decideSafetyRoute('我家住在彩虹路，我的学校是森林小学', 'children')).toMatchObject({ route: 'child-privacy' })
  })

  it.each([
    '我想自杀结束生命',
    '我打算马上伤害自己',
    '我现在要杀了他然后报复',
    '有人正在跟踪我，我现在很危险',
  ])('routes urgent danger away from entertainment: %s', (text) => {
    const decision = decideSafetyRoute(text, 'mirror')
    expect(decision.route).toBe('urgent-support')
    expect(decision.message).toContain('紧急服务')
  })

  it.each([
    '我叫小明，今年八岁',
    '我的手机号是' + ['138', '0013', '8000'].join(''),
    '爸爸妈妈不在，我的学校是森林小学',
  ])('protects identifying child details: %s', (text) => {
    expect(decideSafetyRoute(text, 'children').route).toBe('child-privacy')
  })

  it('does not turn ordinary sadness or disagreement into a crisis route', () => {
    expect(decideSafetyRoute('我今天很难过，和朋友吵架后不知道怎么开口', 'mirror').route).toBe('story')
  })
})
