import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyWorldTheme, compileWorld, personalizeWorld } from './worldCompiler'
afterEach(() => vi.unstubAllGlobals())

describe('dynamic world compiler', () => {
  it.each([
    ['同事在汇报时拿走了我的项目功劳', 'workplace'],
    ['我和朋友旅行总谈不拢，关系很僵', 'relationship'],
    ['两个 offer 不知道选哪个，我很纠结', 'decision'],
    ['我在考虑要不要离开现在的工作去读书，但担心收入中断', 'decision'],
    ['我拿到两个完全不同的机会，一个稳定但成长慢，一个冒险但可能失败，我怕以后后悔', 'decision'],
    ['考试失败后觉得自己什么都学不会', 'growth'],
  ] as const)('classifies %s as %s', (source, expected) => expect(classifyWorldTheme(source)).toBe(expected))

  it('creates materially different worlds and reversible actions', () => {
    const workplace = compileWorld('老板汇报里忽略了我的贡献')
    const decision = compileWorld('我不知道要不要离职转行')
    expect(workplace.worldTitle).not.toBe(decision.worldTitle)
    expect(workplace.objectiveTitle).not.toBe(decision.objectiveTitle)
    expect(workplace.reversibleAction).not.toBe(decision.reversibleAction)
    expect(workplace.locationCopy.deck.name).not.toBe(decision.locationCopy.deck.name)
    expect(workplace.clueCopy.clue_draft_map.name).not.toBe(decision.clueCopy.clue_draft_map.name)
    expect(workplace.actionCopy.partnerTalk[0]).not.toBe(decision.actionCopy.partnerTalk[0])
  })

  it('falls back to a safe growth lens for unknown input', () => {
    expect(compileWorld('今天心里有一团说不清的东西').themeId).toBe('growth')
  })

  it('keeps a concrete real-world response alongside the optional metaphor world', () => {
    const source = '老师不允许我出来实习，但秋招需要实习经历，还要求我随时跨城返校'
    const world = compileWorld(source)
    expect(world.realWorldAnalysis.situationSummary).toMatch(/老师.*秋招/)
    expect(world.realWorldAnalysis.conversationScript).toMatch(/哪些条件|具体风险/)
    expect(world.realWorldAnalysis.options.join('')).toMatch(/培养方案|实习规定/)
  })

  it('accepts a valid generated skin while preserving the tested rules scaffold', async () => {
    const fallback = compileWorld('两个机会让我很纠结')
    const generated = {
      worldTitle: '两扇门的钟表铺', metaphor: '两只走速不同的怀表', openingQuestion: '哪些代价可以先验证？',
      objectiveTitle: '把终局拆成试走', objectiveDetail: '分开可逆步骤与不可逆代价。', conflictFocus: '机会与确定性的取舍',
      reflectionLens: '你愿意用什么小成本换回真实信息？', reversibleAction: '明天分别约两位相关人聊十五分钟，只核对一个关键假设。',
      openingNarrative: '钟表铺里，两只怀表同时响起。它们各自指向一扇门，却没有任何一只愿意替你承担门后的代价。你把最担心的事写在纸上，决定先寻找能被验证的部分，再讨论终局。',
      chapterTitles: ['两只怀表', '担心不是事实', '试走一小步', '带回新信息'],
      lexicon: { partnerName: '快针', witnessName: '修表人迟青', captainName: '守门人刻度', artifact: '两份门票', record: '试走记录', process: '门槛评估', outcome: '下一步方向' },
      agentBriefs: {
        partner: { name: '快针', principle: '偏好速度但不承担别人的代价', goal: '推动一次有限试走' },
        witness: { name: '修表人迟青', principle: '只记录实际走过的时间', goal: '分开经验和预测' },
        captain: { name: '守门人刻度', principle: '退出条件不清楚就不开门', goal: '确认边界和止损线' },
      },
      locationCopy: {
        deck: { name: '钟表铺前厅', shortName: '前厅', description: '两扇门和两只怀表都在这里等待。' },
        chart_room: { name: '试走工坊', shortName: '工坊', description: '这里记录每次小范围试走的结果。' },
        crow_nest: { name: '旧钟档案室', shortName: '档案室', description: '相似选择被保存，但不冒充玩家的未来。' },
        captain_room: { name: '刻度门廊', shortName: '门廊', description: '只有退出条件明确的试走才能通过。' },
      },
      clueCopy: {
        clue_draft_map: { name: '两张门票的期限', meaning: '能证明选择窗口，不能预测门后的结果。' },
        clue_ink_smudge: { name: '怀表上的停顿', meaning: '能提示一个担忧，不能证明它必然发生。' },
        clue_night_log: { name: '旧钟维修记录', meaning: '能提供历史参照，不能代替本次条件。' },
        clue_witness_trust: { name: '修表人的有限经验', meaning: '能说明一种可能，不能替玩家作决定。' },
        clue_captain_doubt: { name: '守门人的退出刻度', meaning: '能确认止损边界，不能消除所有风险。' },
        clue_combined_proof: { name: '一次可退出的试走', meaning: '把期限、代价与退出条件连接起来。' },
      },
      actionCopy: {
        observe: '观察两只怀表的停顿', investigate: '核对两张门票的期限', combine: '拼出一次可退出的试走',
        partnerTalk: ['问快针为何催促', '核对快针承担的代价', '说清不能接受的风险'],
        witnessTalk: ['询问迟青修过的旧钟', '只确认真实记录', '区分经验与预测'],
        captainTalk: ['询问开门条件', '提交退出刻度', '确认止损信号'],
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(generated))))
    const result = await personalizeWorld('两个机会让我很纠结', fallback)
    expect(result.worldTitle).toBe('两扇门的钟表铺')
    expect(result.generated).toBe(true)
    expect(result.locationCopy.deck.name).toBe('钟表铺前厅')
  })

  it('falls back when generated world violates the schema', async () => {
    const fallback = compileWorld('今天心里很乱')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ worldTitle: '只有标题' }))))
    await expect(personalizeWorld('今天心里很乱', fallback)).resolves.toBe(fallback)
  })
})
