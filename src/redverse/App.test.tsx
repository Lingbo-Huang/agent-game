import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialWorldState } from './content'
import { ClassicGame, DetectiveGame, FusuGame, Game, Reflection } from './App'
import RedverseApp from './App'
import { classicBeats } from './classicStory'
import { compileWorld } from './worldCompiler'
import { fusuBeats } from './fusuStory'
import { detectiveBeats } from './detectiveStory'

afterEach(() => cleanup())

afterEach(() => cleanup())

describe('game action timing', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/status')) return Promise.resolve(new Response(JSON.stringify({ aiEnabled: true, imageEnabled: true })))
      // 故意让旁白与插画永远不返回，用来证明它们不能阻塞下一组选项。
      return new Promise<Response>(() => undefined)
    }))
  })

  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('replaces actions immediately while narration is still pending', () => {
    render(<Game source="测试困惑" initialState={createInitialWorldState()} onReflect={vi.fn()} onExit={vi.fn()} />)

    expect(screen.getByLabelText('第 1 回合可选行动').getAttribute('data-action-turn')).toBe('0')
    fireEvent.click(screen.getByTitle('先提出问题，不急着下结论'))

    expect(screen.getByLabelText('第 2 回合可选行动').getAttribute('data-action-turn')).toBe('1')
    expect(screen.queryByTitle('先提出问题，不急着下结论')).toBeNull()
    expect(screen.getByTitle('把感觉变成可验证的信息')).toBeTruthy()
    expect(screen.getByRole('status', { name: /已选择/ }).textContent).toContain('听清回声在说什么')
    expect(screen.getByTitle('把感觉变成可验证的信息').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText(/新选项已生效；叙事者仍在润色上一回合/)).toBeTruthy()
  })

  it('lets the player collapse and restore the scene image', () => {
    window.localStorage.removeItem('redverse:scene-collapsed')
    render(<Game source="测试困惑" initialState={createInitialWorldState()} onReflect={vi.fn()} onExit={vi.fn()} />)

    const collapse = screen.getByRole('button', { name: '收起场景图片' })
    fireEvent.click(collapse)
    expect(screen.getByRole('button', { name: '展开场景图片' }).getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('.rv-scene-card')?.classList.contains('is-collapsed')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '展开场景图片' }))
    expect(screen.getByRole('button', { name: '收起场景图片' }).getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('.rv-scene-card')?.classList.contains('is-collapsed')).toBe(false)
  })

  it('labels the soundscape as live browser synthesis tied to the current scene', () => {
    render(<Game source="测试困惑" initialState={createInitialWorldState()} onReflect={vi.fn()} onExit={vi.fn()} />)
    const soundscape = screen.getByRole('button', { name: /实时声景/ })
    expect(soundscape.getAttribute('title')).toContain('浏览器实时合成')
    expect(soundscape.getAttribute('title')).toContain('甲板风浪')
  })

  it('distinguishes immediate world settlement from asynchronous character agent proposals', async () => {
    let resolveCharacters: ((value: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/status')) return Promise.resolve(new Response(JSON.stringify({ aiEnabled: true })))
      if (url.endsWith('/api/character-proposals')) return new Promise<Response>((resolve) => { resolveCharacters = resolve })
      if (url.endsWith('/api/narrate')) return new Promise<Response>(() => undefined)
      return Promise.resolve(new Response('{}', { status: 503 }))
    })
    render(<Game source="测试困惑" initialState={createInitialWorldState()} onReflect={vi.fn()} onExit={vi.fn()} />)
    await screen.findByText(/角色模型已就绪/)

    fireEvent.click(screen.getByTitle('先提出问题，不急着下结论'))
    expect(screen.getByText(/角色 Agent 正在分别思考/)).toBeTruthy()
    expect(screen.getByLabelText('第 2 回合可选行动')).toBeTruthy()

    resolveCharacters?.(new Response(JSON.stringify({ actions: [] })))
    await screen.findByText(/确定性角色策略接管/)
  })

  it('uses local narration without calling protected AI endpoints when AI is unavailable', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/status')) return Promise.resolve(new Response(JSON.stringify({ aiEnabled: false, imageEnabled: false })))
      return Promise.reject(new Error(`unexpected protected request: ${url}`))
    })
    render(<Game source="测试困惑" initialState={createInitialWorldState()} onReflect={vi.fn()} onExit={vi.fn()} />)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))

    fireEvent.click(screen.getByTitle('先提出问题，不急着下结论'))
    await screen.findByRole('button', { name: '显示完整字幕' })

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(screen.getByLabelText('第 2 回合可选行动').getAttribute('data-action-turn')).toBe('1')
  })

  it('replaces actions immediately while the previous subtitle is still typing', async () => {
    const narration = '海风掠过仍亮着灯的甲板，你刚才的选择已经改变了眼前能确认的信息。新的痕迹浮现出来，但它只能证明发生过什么，还不能替任何人解释动机。远处的钟声继续推进时间，角色也各自守着自己的立场。现在，你已经可以选择下一步从哪里寻找独立证据。'
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/status')) return Promise.resolve(new Response(JSON.stringify({ aiEnabled: true })))
      if (url.endsWith('/api/narrate')) return Promise.resolve(new Response(JSON.stringify({ text: narration })))
      return new Promise<Response>(() => undefined)
    })
    render(<Game source="测试困惑" initialState={createInitialWorldState()} onReflect={vi.fn()} onExit={vi.fn()} />)

    fireEvent.click(screen.getByTitle('先提出问题，不急着下结论'))
    const typingSubtitle = await screen.findByRole('button', { name: '显示完整字幕' })
    expect(screen.getByLabelText('第 2 回合可选行动').getAttribute('data-action-turn')).toBe('1')

    fireEvent.click(screen.getByTitle('把感觉变成可验证的信息'))

    expect(screen.getByLabelText('第 3 回合可选行动').getAttribute('data-action-turn')).toBe('2')
    expect(screen.queryByTitle('把感觉变成可验证的信息')).toBeNull()
    expect(screen.getByTitle('听见一个有自身立场的视角')).toBeTruthy()
    expect(screen.getByRole('button', { name: '显示完整字幕' })).toBe(typingSubtitle)
    expect(screen.getByText(/字幕正在讲述上一回合，但你现在就可以继续选择/)).toBeTruthy()
  })
})

describe('dynamic world UI', () => {
  it('offers a visible voice entry and optional guided agent questions', () => {
    render(<RedverseApp />)
    expect(screen.getByRole('button', { name: '开始语音讲述' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /回答 2 个问题/ }))
    expect(screen.getByLabelText('引导 Agent 追问')).toBeTruthy()
    expect(screen.getByText(/我不会替你判断/)).toBeTruthy()
  })

  it('shows a different compiled world for a decision dilemma', () => {
    render(<RedverseApp />)
    fireEvent.change(screen.getByLabelText('描述你想探索的事情'), { target: { value: '我拿到两个 offer，不知道要不要离职转行' } })
    fireEvent.click(screen.getByRole('button', { name: /开始一场决策排练/ }))
    expect(screen.getByRole('heading', { name: /岔航群岛的未寄罗盘已经成形/ })).toBeTruthy()
  })

  it('compiles decision-specific locations, roles and actions into gameplay', () => {
    const source = '我在考虑要不要离开现在的工作去读书，但担心收入中断'
    const world = compileWorld(source)
    render(<Game source={source} world={world} initialState={createInitialWorldState()} onReflect={vi.fn()} onExit={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '岔航码头' })).toBeTruthy()
    expect(screen.getByText('催你立刻启航的同行者')).toBeTruthy()
    expect(screen.getByRole('button', { name: /分开事实和最坏想象/ })).toBeTruthy()
    expect(screen.queryByText('庆典甲板')).toBeNull()
  })

  it('keeps decision-world narration and reflection free of default workplace names', async () => {
    const source = '我拿到两个 offer，不知道要不要离职转行，但担心收入中断'
    const world = compileWorld(source)
    const onReflect = vi.fn()
    render(<Game source={source} world={world} initialState={createInitialWorldState()} onReflect={onReflect} onExit={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button', { name: /问洛岚为什么催你启航/ }).at(-1)!)
    await screen.findByText(/洛岚的催促/)
    expect(screen.queryByText(/沈亦舟/)).toBeNull()
  })

  it('grounds the reflection and reversible action in the compiled dilemma', () => {
    const source = '我在考虑要不要离开现在的工作去读书，但担心收入中断'
    const world = compileWorld(source)
    const state = createInitialWorldState()
    state.currentTurn = 4
    state.actionCounts['investigate:deck'] = 1
    state.clues.clue_ink_smudge = 'discovered'
    const onReflect = vi.fn()
    const { rerender } = render(<Game source={source} world={world} initialState={state} onReflect={onReflect} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /把本局方法带回现实/ }))
    const reflected = onReflect.mock.calls[0][0]
    rerender(<Reflection state={reflected} source={source} world={world} onBack={vi.fn()} onRestart={vi.fn()} />)
    expect(screen.getByText(/七天、可退出的小规模试验/)).toBeTruthy()
    expect(screen.getAllByText(/不确定中的取舍与后悔/).length).toBeGreaterThan(0)
  })

  it('turns the played history into a transparent local reel storyboard', () => {
    const state = createInitialWorldState()
    state.currentTurn = 4
    state.log.push({ turn: 1, timeLabel: '庆典夜 · 22:10', kind: 'narration', text: '你先观察甲板，发现了一处可以继续核对的异常。' })
    render(<Reflection state={state} source="我的现实困惑" world={compileWorld('同事抢了功劳')} onBack={vi.fn()} onRestart={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /把本局变成一支回响短片/ }))
    expect(screen.getByText(/不上传你的原文/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /导出 15 秒回响短片/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /生成 AI 回响短片/ })).toBeTruthy()
    expect(screen.getByText(/不发送你输入的现实原文/)).toBeTruthy()
  })

  it('requires four effective decisions before reflection is available', () => {
    const state = createInitialWorldState()
    state.currentTurn = 3
    const onReflect = vi.fn()
    render(<Game source="测试困惑" initialState={state} onReflect={onReflect} onExit={vi.fn()} />)

    const locked = screen.getByRole('button', { name: /再行动 1 次即可回看/ }) as HTMLButtonElement
    expect(locked.disabled).toBe(true)
    fireEvent.click(locked)
    expect(onReflect).not.toHaveBeenCalled()
  })

  it('shows the exact ending route and keeps the final action reachable', () => {
    const source = '同事把我参与项目的功劳都说成了自己的'
    const workplaceWorld = compileWorld(source)
    const ready = createInitialWorldState()
    ready.currentTurn = 8
    ready.playerLocationId = 'chart_room'
    ready.clues.clue_draft_map = 'discovered'
    ready.clues.clue_night_log = 'discovered'
    const first = render(<Game source={source} world={workplaceWorld} initialState={ready} onReflect={vi.fn()} onExit={vi.fn()} />)

    expect(screen.getByRole('list', { name: '结局触发条件' }).textContent).toContain(`主动组合${workplaceWorld.clueCopy.clue_combined_proof.name}`)
    expect(screen.getByText(/两份信息齐全后，点击金色的“组合”行动/)).toBeTruthy()
    expect(screen.getAllByText(workplaceWorld.actionCopy.combine).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(workplaceWorld.actionCopy.combine) }))
    expect(screen.getByRole('button', { name: /前往舰长室提交复核/ })).toBeTruthy()

    const connected = createInitialWorldState()
    connected.currentTurn = 9
    connected.playerLocationId = 'captain_room'
    connected.clues.clue_draft_map = 'discovered'
    connected.clues.clue_night_log = 'discovered'
    connected.clues.clue_combined_proof = 'connected'
    first.unmount()
    render(<Game source={source} world={workplaceWorld} initialState={connected} onReflect={vi.fn()} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /把完整方案交给祝舰长/ }))
    expect(screen.getByRole('button', { name: /查看结局与现实启发/ })).toBeTruthy()
    expect(screen.getByText('结局已触发：事实进入复核')).toBeTruthy()
  })

  it('keeps a visual trail when the player reaches a different story location', async () => {
    const state = createInitialWorldState()
    const visualWorld = compileWorld('同事把我做的项目成果都说成了自己的')
    state.discoveredLocationIds = ['deck', 'chart_room', 'captain_room']
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/status')) return Promise.resolve(new Response(JSON.stringify({ aiEnabled: true, imageEnabled: true })))
      if (url.endsWith('/api/portrait')) return Promise.resolve(new Response(JSON.stringify({ image: 'data:image/png;base64,AA==' })))
      if (url.endsWith('/api/character-proposals')) return Promise.resolve(new Response(JSON.stringify({ actions: [] })))
      return new Promise<Response>(() => undefined)
    }))
    render(<Game source="同事把我做的项目成果都说成了自己的" world={visualWorld} initialState={state} onReflect={vi.fn()} onExit={vi.fn()} />)
    await screen.findByText(/角色模型已就绪/)
    await vi.waitFor(() => expect(screen.getByText(/甲板 · 初见/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /前往制图室/ }))
    await vi.waitFor(() => expect(screen.getByRole('navigation', { name: '本局关键剧情镜头' })).toBeTruthy())
    expect(screen.getByText(/甲板 · 初见/)).toBeTruthy()
    expect(screen.getByText(/制图室 · 第 1 回合/)).toBeTruthy()
  })

  it('keeps distinct local scene art when image generation is unavailable', async () => {
    const state = createInitialWorldState()
    state.discoveredLocationIds = ['deck', 'chart_room']
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/status')) return Promise.resolve(new Response(JSON.stringify({ aiEnabled: true, imageEnabled: false, characterMode: 'parallel-per-character' })))
      if (url.endsWith('/api/character-proposals')) return Promise.resolve(new Response(JSON.stringify({ actions: [], mode: 'parallel-per-character', agentsConsulted: 3 })))
      return new Promise<Response>(() => undefined)
    }))
    render(<Game source="测试场景变化" initialState={state} onReflect={vi.fn()} onExit={vi.fn()} />)
    await vi.waitFor(() => expect(document.querySelector('.rv-harbor--deck')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /前往工坊/ }))
    await vi.waitFor(() => expect(document.querySelector('.rv-harbor--chart_room')).toBeTruthy())
    expect(document.querySelectorAll('.rv-scene-filmstrip button')).toHaveLength(2)
    expect(fetch).not.toHaveBeenCalledWith('/api/portrait', expect.anything())
  })

  it('shows prolonged waiting as an explicit alternative ending', () => {
    const state = createInitialWorldState()
    state.currentTurn = 12
    state.activeWorldline = 'forgetting'
    state.flags.ending_reached = true
    state.flags.ending_kind = 'forgetting'
    render(<Game source="我一直不敢开口" initialState={state} onReflect={vi.fn()} onExit={vi.fn()} />)

    expect(screen.getByText(/默认翻篇.*等待保护了当下/)).toBeTruthy()
    expect(screen.getByText(/另一条路径：核对两个独立来源/)).toBeTruthy()
    expect(screen.getByRole('region', { name: '本局结局已触发' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /让时间继续推进/ })).toBeNull()
    expect(screen.getByRole('button', { name: /查看结局与现实启发/ })).toBeTruthy()
  })
})

describe('classic route', () => {
  it('completes the long-form decisions and preserves canon labels', () => {
    render(<ClassicGame onExit={vi.fn()} />)
    for (let index = 0; index < classicBeats.length - 1; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(classicBeats[index].choices[0].title) }))
      expect(screen.getAllByText(/原作事实/).length).toBeGreaterThan(0)
      fireEvent.click(screen.getByRole('button', { name: /进入下一幕/ }))
    }
    fireEvent.click(screen.getByRole('button', { name: new RegExp(classicBeats.at(-1)!.choices[0].title) }))
    fireEvent.click(screen.getByRole('button', { name: /查看原作对照/ }))
    expect(screen.getByText('本局原作对照')).toBeTruthy()
    expect(screen.getByText(/军令 → 借船备草 → 等雾登船/)).toBeTruthy()
    const history = screen.getByRole('list', { name: `本局${classicBeats.length}次选择` })
    expect(history.children).toHaveLength(classicBeats.length)
  })
})

describe('additional content packs', () => {
  it('opens the content library from the classic route card', () => {
    render(<RedverseApp />)
    fireEvent.click(screen.getByRole('button', { name: /草船借箭/ }))
    expect(screen.getByRole('heading', { name: /每一局都有可见的结局条件/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /魂穿扶苏/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /雾港谜案/ })).toBeNull()
    expect(screen.getByRole('button', { name: /十秒接住吕布/ })).toBeTruthy()
  })

  it('completes ten fusu decisions and shows the historical boundary', () => {
    render(<FusuGame onExit={vi.fn()} />)
    for (let index = 0; index < fusuBeats.length - 1; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(fusuBeats[index].choices[0].title) }))
      fireEvent.click(screen.getByRole('button', { name: /进入下一幕/ }))
    }
    fireEvent.click(screen.getByRole('button', { name: new RegExp(fusuBeats.at(-1)!.choices[0].title) }))
    expect(screen.getByText(/真实历史没有被改写/)).toBeTruthy()
    expect(screen.getByRole('list', { name: '本局10次选择' }).children).toHaveLength(10)
  })

  it('completes the original detective case with explicit evidence limits', () => {
    render(<DetectiveGame onExit={vi.fn()} />)
    expect(screen.getByText('它不能证明')).toBeTruthy()
    for (let index = 0; index < detectiveBeats.length - 1; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(detectiveBeats[index].choices[0].title) }))
      fireEvent.click(screen.getByRole('button', { name: /前往下一地点/ }))
    }
    fireEvent.click(screen.getByRole('button', { name: new RegExp(detectiveBeats.at(-1)!.choices[0].title) }))
    expect(screen.getByText(/馆长获救，动机仍待核验/)).toBeTruthy()
    expect(screen.getByRole('list', { name: '本局8次选择' }).children).toHaveLength(8)
  })
})
