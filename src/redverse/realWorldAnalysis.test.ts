import { describe, expect, it } from 'vitest'
import { buildLocalRealWorldAnalysis } from './realWorldAnalysis'

describe('real-world analysis', () => {
  it('answers the teacher, internship and autumn-recruitment conflict specifically', () => {
    const source = '我的老师不让学生出来实习，但是为了秋招能够有好的机会，大家不得不出来这么做，导致她每次找我们都得肉身返校，甚至有人从深圳飞回南京。她到底是脱离社会太久了，还是纯粹的掌控欲？'
    const result = buildLocalRealWorldAnalysis(source, 'decision')
    const whole = JSON.stringify(result)

    expect(result.situationSummary).toMatch(/老师.*秋招/)
    expect(result.emotionalAcknowledgement).toMatch(/着急|憋屈|无力/)
    expect(whole).toContain('实习')
    expect(whole).toMatch(/培养方案|实习规定/)
    expect(whole).toMatch(/辅导员|研究生秘书|院系/)
    expect(result.conversationScript).toMatch(/最不能接受的具体风险|哪些条件/)
    expect(result.escalationBoundary).toContain('先咨询，不先控诉')
    expect(whole).not.toContain('写下最担心的三个代价')
  })

  it('offers a grounded fallback when no specialist scenario matches', () => {
    const result = buildLocalRealWorldAnalysis('同事汇报时忽略了我的贡献', 'workplace')
    expect(result.knownFacts).toHaveLength(2)
    expect(result.unknowns).toHaveLength(2)
    expect(result.options).toHaveLength(3)
    expect(result.conversationScript).toMatch(/依据|分工/)
  })

  it('grounds an unfamiliar family-care dilemma before entering the world', () => {
    const source = '妈妈最近身体不好，希望我辞掉上海的工作回老家照顾她，但我也承担着房贷，不知道怎么办'
    const result = buildLocalRealWorldAnalysis(source, 'decision')
    const whole = JSON.stringify(result)
    expect(result.situationSummary).toContain('妈妈')
    expect(result.situationSummary).toContain('上海')
    expect(result.knownFacts[0]).toContain('房贷')
    expect(result.unknowns[0]).toContain('妈妈')
    expect(result.conversationScript).toContain('满足哪些条件')
    expect(whole).not.toMatch(/talk:|partner|investigate:/)
  })
})
