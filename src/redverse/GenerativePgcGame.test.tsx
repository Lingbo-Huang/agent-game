import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GenerativePgcGame, type GenerativePgcSpec } from './GenerativePgcGame'
import { fallbackChapter } from './pgcFallback'

const spec: GenerativePgcSpec = {
  id: 'filmstrip-test', title: '镜头测试', eyebrow: '测试世界', opening: '序章正文',
  openingImage: '/opening.webp', freeActionExample: '查看封泥', stageGoal: '核验线索',
  canonConstraints: ['不凭空创造证据'],
  characters: [{ id: 'witness', principles: ['如实记录'], goal: '核验', emotion: '谨慎', knownFacts: ['封泥破损'] }],
  items: [{ id: 'seal', name: '封泥', origin: '驿站', holder: '见证人', status: '破损', purpose: '核验来源', introducedTurn: 0, lastChangedTurn: 0 }],
  fallbackBeats: [{ location: '驿站', title: '序章', background: '封泥裂缝在晨光里清晰可见。', prompt: '裂缝由谁造成？', choices: [
    { id: 'check', title: '查看封泥', consequence: '发现第二道压痕' },
    { id: 'ask', title: '询问见证人', consequence: '确认交接时间' },
    { id: 'wait', title: '等待副本', consequence: '保留现场' },
  ] }],
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear() })

describe('generative PGC chapter visuals', () => {
  it('offers an explicit optional ending after the authored nodes without forcing it', async () => {
    sessionStorage.setItem('redverse:active-story-session:filmstrip-test', 'ending-session')
    sessionStorage.setItem('redverse:story-memory:ending-session', JSON.stringify({
      version: 1, sessionId: 'ending-session', worldId: 'filmstrip-test', turn: 1, stageGoal: '核验线索', currentLocation: '驿站',
      allowedLocations: ['驿站'], canonConstraints: ['不凭空创造证据'], characters: spec.characters,
      items: [{ ...spec.items[0], lastChangedTurn: 1 }], threads: [], longTermSummary: [],
      events: [{ turn: 1, playerAction: '查看封泥', consequence: '确认第二道压痕。', characterReactions: ['witness：只确认亲眼所见'], location: '驿站', itemChanges: ['seal：已复核'], actorName: '甲' }],
    }))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }))
    render(<GenerativePgcGame spec={spec} onExit={() => undefined} />)
    const ending = screen.getByRole('button', { name: /主动收束本局/ })
    expect(screen.getByRole('button', { name: /查看封泥/ })).not.toBeNull()
    fireEvent.click(ending)
    expect(screen.getByRole('region', { name: '本局主动结局' })).not.toBeNull()
    expect(screen.getByText(/由你主动收束/)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '结局之后继续改写世界' }))
    expect(screen.getByText('你选择了在结局之后继续承担后果。')).not.toBeNull()
  })

  it('gives semantically different consequences and next actions to arbitrary fallback input', () => {
    const investigate = fallbackChapter(spec, 0, '我检查封泥并记录压痕')
    const talk = fallbackChapter(spec, 0, '我询问见证人昨夜交接时间')
    expect(investigate.paragraphs.join('')).toContain('封泥被翻到明处')
    expect(investigate.stateDelta?.itemChanges?.[0]?.itemId).toBe('seal')
    expect(investigate.suggestedActions.map((item) => item.title)).toContain('查看封泥')
    expect(talk.paragraphs.join('')).toContain('询问见证人昨夜交接时间')
    expect(talk.characterReactions[0]?.characterId).toBe('witness')
    expect(talk.suggestedActions.map((item) => item.title)).toContain('询问见证人')
  })

  it('keeps a free-form historical fallback inside its authored world instead of generic advice', () => {
    const caoCaoSpec: GenerativePgcSpec = {
      ...spec,
      id: 'caocao-assassination-test',
      title: '重回刺董之夜',
      characters: [{ id: 'dongzhuo', principles: ['多疑'], goal: '追查曹操', emotion: '暴躁', knownFacts: ['刺杀暴露'] }],
      items: [{ id: 'blade', name: '七星宝刀', origin: '王允府', holder: '曹操', status: '在手', purpose: '献刀或刺杀', introducedTurn: 0, lastChangedTurn: 0 }],
      fallbackBeats: [
        { location: '董卓府', title: '刺杀暴露', background: '铜镜照见刀锋。', prompt: '吕布正在接近。', choices: spec.fallbackBeats[0].choices },
        { location: '洛阳西门', title: '逃出洛阳', background: '城门贴出画像。', prompt: '追兵正在封城。', choices: spec.fallbackBeats[0].choices },
      ],
    }
    const chapter = fallbackChapter(caoCaoSpec, 0, '我潜回王允府取证，并让旧识向西门散布假消息')
    expect(chapter.paragraphs.join('')).toContain('王允府取证')
    expect(chapter.paragraphs.join('')).toContain('董卓的人')
    expect(chapter.paragraphs.join('')).not.toContain('独立来源')
    expect(chapter.stateDelta?.location).toBe('洛阳西门')
    expect(chapter.suggestedActions.map((item) => item.title)).toContain('查看封泥')
  })

  it('advances visible choices to the next authored beat after committing an action', () => {
    const twoBeatSpec: GenerativePgcSpec = {
      ...spec,
      fallbackBeats: [
        spec.fallbackBeats[0],
        { location: '城门', title: '追兵封城', background: '画像已经贴上城门。', prompt: '怎样出城？', choices: [
          { id: 'forge', title: '伪造身份', consequence: '降低正面冲突，留下查验风险' },
          { id: 'bribe', title: '贿赂守卫', consequence: '换取速度，增加把柄' },
          { id: 'alley', title: '改走暗巷', consequence: '避开城门，消耗时间' },
        ] },
      ],
    }
    const chapter = fallbackChapter(twoBeatSpec, 0, '查看封泥')
    expect(chapter.suggestedActions.map((item) => item.title)).toEqual(['伪造身份', '贿赂守卫', '改走暗巷'])
    expect(chapter.suggestedActions.map((item) => item.title)).not.toContain('查看封泥')
  })

  it('restores a chapter consistent with saved world memory after refresh', async () => {
    sessionStorage.setItem('redverse:active-story-session:filmstrip-test', 'saved-session')
    sessionStorage.setItem('redverse:story-memory:saved-session', JSON.stringify({
      version: 1, sessionId: 'saved-session', worldId: 'filmstrip-test', turn: 1, stageGoal: '核验线索', currentLocation: '驿站',
      allowedLocations: ['驿站'], canonConstraints: ['不凭空创造证据'], characters: spec.characters, items: spec.items, threads: [], longTermSummary: [],
      events: [{ turn: 1, playerAction: '询问见证人', consequence: '见证人确认了交接时间。', characterReactions: ['witness：只确认亲眼所见'], location: '驿站', itemChanges: [], actorName: '甲' }],
    }))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }))
    render(<GenerativePgcGame spec={spec} onExit={() => undefined} />)
    expect(screen.getByRole('heading', { name: '序章' })).not.toBeNull()
    expect(screen.getAllByText('询问见证人').length).toBeGreaterThan(0)
    expect(document.body.textContent).toContain('witness面前')
    expect(screen.getByText('第 1 回合 · 你的行动已经写入世界')).not.toBeNull()
  })

  it('keeps the opening frame while a new chapter image fails gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }))
    render(<GenerativePgcGame spec={spec} onExit={() => undefined} />)
    expect(screen.getByRole<HTMLImageElement>('img', { name: /第1章剧情画面/ }).src).toContain('/opening.webp')
    fireEvent.click(screen.getByRole('button', { name: /查看封泥/ }))
    await waitFor(() => expect(screen.queryByText('本章以文字与声景演出')).not.toBeNull())
    expect(screen.getAllByRole('button', { name: /查看第\d章镜头/ })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /查看第1章镜头/ }))
    expect(screen.getByRole<HTMLImageElement>('img', { name: /第1章剧情画面/ }).src).toContain('/opening.webp')
  })

  it('exposes voice, soundscape and spoken free-action controls without hiding the opening image', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/api/status')) return Promise.resolve(new Response(JSON.stringify({ imageEnabled: true, ttsEnabled: false }), { status: 200 }))
      return Promise.resolve(new Response('', { status: 503 }))
    })
    render(<GenerativePgcGame spec={spec} onExit={() => undefined} />)
    expect(screen.getByRole('button', { name: /声景/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: /自动配音/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: /朗读本章/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: '说出自由行动' })).not.toBeNull()
    expect(screen.getByRole<HTMLImageElement>('img', { name: /第1章剧情画面/ }).src).toContain('/opening.webp')
  })

  it('lets the player collapse and restore the chapter picture', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }))
    render(<GenerativePgcGame spec={spec} onExit={() => undefined} />)
    const toggle = screen.getByRole('button', { name: '▱ 收起画面' })
    expect(screen.getByRole('img', { name: /第1章剧情画面/ })).not.toBeNull()
    fireEvent.click(toggle)
    expect(screen.queryByRole('img', { name: /第1章剧情画面/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '▣ 展开画面' }))
    expect(screen.getByRole('img', { name: /第1章剧情画面/ })).not.toBeNull()
  })

  it('lets a transient image failure retry instead of caching a blank frame forever', async () => {
    let portraitCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/api/status')) return Promise.resolve(new Response(JSON.stringify({ imageEnabled: true, ttsEnabled: false }), { status: 200 }))
      if (url.endsWith('/api/story-turn')) return Promise.resolve(new Response('', { status: 503 }))
      if (url.endsWith('/api/portrait')) {
        portraitCalls += 1
        return Promise.resolve(portraitCalls === 1
          ? new Response('', { status: 503 })
          : new Response(JSON.stringify({ image: 'data:image/png;base64,SU1BR0U=' }), { status: 200 }))
      }
      return Promise.resolve(new Response('', { status: 404 }))
    })
    render(<GenerativePgcGame spec={{ ...spec, id: 'filmstrip-retry-test' }} onExit={() => undefined} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /查看封泥/ })).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /查看封泥/ }))
    const retry = await screen.findByRole('button', { name: '重试生成本章镜头' })
    fireEvent.click(retry)
    await waitFor(() => expect(screen.getByRole<HTMLImageElement>('img', { name: /第2章剧情画面/ }).src).toContain('data:image/png'))
    expect(portraitCalls).toBe(2)
  })
})
