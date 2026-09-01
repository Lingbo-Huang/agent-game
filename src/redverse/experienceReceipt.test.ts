import { describe, expect, it } from 'vitest'
import { buildExperienceReceipt } from './experienceReceipt'
import { compileWorld } from './worldCompiler'

describe('experience receipt', () => {
  it('keeps a reported situation separate from verified facts and unknown motives', () => {
    const source = '同事汇报时没有提我的贡献，我很不爽，又怕说出来影响关系。'
    const receipt = buildExperienceReceipt(source, compileWorld(source))
    expect(receipt.reportedFact).toContain('你报告的情境')
    expect(receipt.reportedFact).toContain('不会被系统自动当成')
    expect(receipt.feeling).toContain('生气或委屈')
    expect(receipt.unknown).toContain('真实动机')
  })

  it('turns a decision into a bounded experiment', () => {
    const source = '我纠结要不要离职去另一个城市。'
    const world = compileWorld(source)
    const receipt = buildExperienceReceipt(source, world)
    expect(world.themeId).toBe('decision')
    expect(receipt.experiment).toContain(world.objectiveTitle)
    expect(receipt.unknown).toContain('不可逆')
  })
})
