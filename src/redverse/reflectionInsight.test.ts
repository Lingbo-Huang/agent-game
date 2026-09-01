import { describe, expect, it } from 'vitest'
import { createInitialWorldState } from './content'
import { buildLocalReflectionInsight, parseReflectionInsight } from './reflectionInsight'
import { compileWorld } from './worldCompiler'

describe('reflection insight', () => {
  it('gives the internship dilemma scenario-specific empathy, tradeoffs and a script', () => {
    const source = '我的老师不让学生出来实习，但是为了秋招能有好机会，我又担心她贸然去深圳适应不了，也怕把她当私人资产'
    const insight = buildLocalReflectionInsight(source, createInitialWorldState(), compileWorld(source))
    expect(insight.acknowledgement).toContain('秋招')
    expect(insight.acknowledgement).toContain('异地')
    expect(insight.unknowns.join('')).toContain('住宿')
    expect(insight.options).toHaveLength(3)
    expect(insight.nextStep.script).toContain('限制实习和返校要求依据哪条规定')
    expect(insight.nextStep.stopCondition).toContain('研究生秘书')
  })

  it('keeps the original reporter on the student side', () => {
    const source = '我的老师不让学生出来实习，但是为了秋招能够有好的机会，大家不得不出来这么做，导致她每次找我们都得肉身返校，随叫随到，甚至有人为此从深圳飞回南京。她到底是脱离社会太久了，还是纯粹的掌控欲，把我们当作她的私人资产？'
    const insight = buildLocalReflectionInsight(source, createInitialWorldState(), compileWorld(source))
    const copy = JSON.stringify(insight)
    expect(insight.acknowledgement).toMatch(/随叫随到|异地返校/)
    expect(insight.coreTension).toMatch(/限制实习|临时返校/)
    expect(insight.nextStep.script).toMatch(/老师，我理解您担心/)
    expect(copy).toMatch(/辅导员|研究生秘书|院系负责人/)
    expect(copy).not.toContain('你不是单纯在“拦着学生”')
    expect(copy).not.toContain('你对学生的准备程度')
  })

  it('never exposes internal action keys in local user-facing copy', () => {
    const source = '同事汇报时没有提到我的贡献，我不知道要不要直接说'
    const insight = buildLocalReflectionInsight(source, createInitialWorldState(), compileWorld(source))
    expect(JSON.stringify(insight)).not.toMatch(/talk:|investigate:|partner/)
  })

  it.each([
    ['家庭照护', '妈妈最近身体不好，希望我辞掉上海的工作回老家照顾她，但我也承担着房贷，不知道怎么办', /妈妈|上海|房贷/],
    ['合作归属', '合伙人在客户会上把我们的方案说成他独立完成，下周就要谈续约，我怕现在翻脸丢掉客户', /合伙人|下周|客户/],
    ['异地去留', '女友希望我年底去深圳，但我刚在北京拿到晋升机会，答应任何一边都像会失去另一边', /女友|年底|深圳|北京/],
  ])('uses the same protocol while grounding an unfamiliar %s dilemma', (_label, source, anchorPattern) => {
    const insight = buildLocalReflectionInsight(source, createInitialWorldState(), compileWorld(source))
    const copy = JSON.stringify(insight)
    expect(copy).toMatch(anchorPattern)
    expect(insight.knownFacts[0]).toContain(source.slice(0, 12))
    expect(insight.options).toHaveLength(3)
    expect(insight.options.every((option) => option.upside && option.cost && option.bestWhen)).toBe(true)
    expect(insight.nextStep.steps.length).toBeGreaterThanOrEqual(3)
    expect(insight.nextStep.successSignal).toBeTruthy()
    expect(insight.nextStep.stopCondition).toBeTruthy()
  })

  it('rejects incomplete model output', () => {
    expect(parseReflectionInsight({ acknowledgement: '理解你', options: [] })).toBeNull()
  })
})
