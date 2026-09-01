import { useEffect, useMemo, useRef, useState } from 'react'
import { MimoVoiceSettings } from './MimoVoiceSettings'
import { generatePortrait } from './narrator'
import { generateStoryTurn, type GeneratedStoryTurn, type StoryCharacterContext } from './storyDirector'
import { buildStoryTurnContext, commitStoryEvent, createStoryMemory, getActiveStorySessionId, loadStoryMemory, saveStoryMemory, type StoryItemState, type StoryMemory } from './storyMemory'
import { useMimoVoice } from './useMimoVoice'
import { useSoundscape } from './useSoundscape'
import { useSpeechInput } from './useSpeechInput'
import { fallbackChapter } from './pgcFallback'
import { buildSharedStoryResult, decodeSharedStory } from './shareStory'
import { buildSeedanceDirectorPrompt, createSeedanceTask, getSeedanceTask, type SeedanceTask, type SeedanceTaskStatus } from './seedance'

export interface PgcFallbackBeat {
  location: string
  title: string
  background: string
  prompt: string
  choices: Array<{ id: string; title: string; consequence: string }>
}

export interface GenerativePgcSpec {
  id: string
  title: string
  eyebrow: string
  opening: string
  openingImage?: string
  freeActionExample: string
  stageGoal: string
  canonConstraints: string[]
  characters: StoryCharacterContext[]
  items: StoryItemState[]
  fallbackBeats: PgcFallbackBeat[]
}

type SceneFrame = {
  turn: number
  title: string
  prompt?: string
  image?: string
  status: 'ready' | 'developing' | 'unavailable'
}

type TurnStage = 'idle' | 'memory' | 'agents' | 'commit'

export function GenerativePgcGame({ spec, onExit }: { spec: GenerativePgcSpec; onExit: () => void }) {
  const stageRef = useRef<HTMLElement>(null)
  const imported = useMemo(() => decodeSharedStory(window.location.hash, spec.id), [spec.id])
  const sessionId = useMemo(() => getActiveStorySessionId(spec.id), [spec.id])
  const restoredMemory = useMemo(() => imported ? { ...imported.memory, sessionId } : loadStoryMemory(sessionId), [imported, sessionId])
  const [memory, setMemory] = useState<StoryMemory>(() => restoredMemory || createStoryMemory({
      sessionId, worldId: spec.id, stageGoal: spec.stageGoal, currentLocation: spec.fallbackBeats[0].location,
      allowedLocations: [...new Set(spec.fallbackBeats.map((beat) => beat.location))],
      canonConstraints: spec.canonConstraints, characters: spec.characters, items: spec.items,
    }))
  const [chapter, setChapter] = useState<GeneratedStoryTurn>(() => imported?.chapter || (restoredMemory?.events.at(-1) ? fallbackChapter(spec, Math.max(0, restoredMemory.turn - 1), restoredMemory.events.at(-1)!.playerAction) : ({
    title: '序章', paragraphs: [spec.opening, spec.fallbackBeats[0].background], characterReactions: [],
    suggestedActions: spec.fallbackBeats[0].choices.map((item) => ({ id: item.id, title: item.title, intent: item.consequence })),
    imagePrompts: [`东方历史互动叙事电影镜头，${spec.title}，${spec.fallbackBeats[0].location}，人物形象一致，无文字，16:9`], newThread: spec.fallbackBeats[0].prompt,
  })))
  const [history, setHistory] = useState<Array<{ action: string; chapter: GeneratedStoryTurn }>>([])
  const [freeText, setFreeText] = useState('')
  const [loading, setLoading] = useState(false)
  const [turnStage, setTurnStage] = useState<TurnStage>('idle')
  const [selectedAction, setSelectedAction] = useState('')
  const [frames, setFrames] = useState<SceneFrame[]>([{ turn: restoredMemory?.turn || 0, title: restoredMemory?.events.at(-1) ? spec.fallbackBeats[Math.min(Math.max(0, restoredMemory.turn - 1), spec.fallbackBeats.length - 1)].title : '序章', prompt: `东方历史互动叙事电影镜头，${spec.title}，${restoredMemory?.currentLocation || spec.fallbackBeats[0].location}，人物形象一致，无文字，16:9`, image: spec.openingImage, status: spec.openingImage ? 'ready' : 'unavailable' }])
  const [viewingTurn, setViewingTurn] = useState(restoredMemory?.turn || 0)
  const [mode, setMode] = useState<'ready' | 'ai' | 'fallback'>('ready')
  const [generationNote, setGenerationNote] = useState('')
  const [imageEnabled, setImageEnabled] = useState<boolean | null>(null)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false)
  const [shareState, setShareState] = useState(imported ? '已从朋友的节点创建新分支' : '')
  const [actorName, setActorName] = useState('本地玩家')
  const [showPrologue, setShowPrologue] = useState(() => !imported && memory.turn === 0)
  const [cinemaMode, setCinemaMode] = useState(false)
  const [sceneCollapsed, setSceneCollapsed] = useState(false)
  const [endingOpen, setEndingOpen] = useState(false)
  const [continuedBeyondCanon, setContinuedBeyondCanon] = useState(false)
  const [seedanceStatus, setSeedanceStatus] = useState<SeedanceTaskStatus>('idle')
  const [seedanceTask, setSeedanceTask] = useState<SeedanceTask | null>(null)
  const [seedanceError, setSeedanceError] = useState('')
  const seedanceAbortRef = useRef<AbortController | null>(null)
  const voice = useMimoVoice()
  const soundscape = useSoundscape('fog')
  const speech = useSpeechInput(setFreeText)

  const visibleFrame = frames.find((frame) => frame.turn === viewingTurn) || frames.at(-1)!
  const endingAvailable = memory.turn >= spec.fallbackBeats.length

  useEffect(() => () => seedanceAbortRef.current?.abort(), [])

  async function generateEndingFilm() {
    seedanceAbortRef.current?.abort()
    const controller = new AbortController()
    seedanceAbortRef.current = controller
    setSeedanceStatus('queued')
    setSeedanceTask(null)
    setSeedanceError('')
    const chosenEvents = memory.events.length > 4 ? [memory.events[0], ...memory.events.slice(-3)] : memory.events
    const prompt = buildSeedanceDirectorPrompt({
      worldTitle: spec.title,
      conflictFocus: spec.stageGoal,
      shots: chosenEvents.map((event) => ({ title: `第${event.turn}幕 · ${event.location}`, meaning: event.playerAction })),
    })
    try {
      let task = await createSeedanceTask(prompt, controller.signal)
      setSeedanceTask(task)
      setSeedanceStatus(task.status)
      while (!controller.signal.aborted && task.status !== 'succeeded' && task.status !== 'failed') {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 3000)
          controller.signal.addEventListener('abort', () => {
            window.clearTimeout(timer)
            reject(new DOMException('Aborted', 'AbortError'))
          }, { once: true })
        })
        task = await getSeedanceTask(task.id, controller.signal)
        setSeedanceTask(task)
        setSeedanceStatus(task.status)
      }
      if (task.status === 'failed') setSeedanceError(task.error || '视频没有生成完成，可以继续回看本局。')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setSeedanceStatus('failed')
      setSeedanceError(error instanceof Error ? error.message : '视频服务暂时不可用')
    }
  }

  function openEnding() {
    setEndingOpen(true)
    setCinemaMode(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/status').then((response) => response.json()).then((status) => {
      if (!cancelled) setImageEnabled(Boolean(status.imageEnabled))
    }).catch(() => { if (!cancelled) setImageEnabled(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const syncFullscreen = () => {
      if (!document.fullscreenElement && cinemaMode) setCinemaMode(false)
    }
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [cinemaMode])

  async function enterCinema() {
    setShowPrologue(false)
    setCinemaMode(true)
    try {
      await stageRef.current?.requestFullscreen?.()
    } catch {
      // The fixed viewport theatre remains usable when a browser blocks native fullscreen.
    }
  }

  async function leaveCinema() {
    setCinemaMode(false)
    if (document.fullscreenElement) {
      try { await document.exitFullscreen() } catch { /* fixed viewport mode can still close */ }
    }
  }

  useEffect(() => {
    fetch('/api/whoami').then((response) => response.ok ? response.json() : null).then((user) => {
      if (user?.username || user?.email) setActorName(user.username || user.email)
    }).catch(() => undefined)
  }, [])

  async function shareCurrentBranch() {
    const result = buildSharedStoryResult(memory, chapter)
    if (result.mode === 'too-large') {
      setShareState('本局浏览器快照已经太长，未生成可能失效的链接。当前版本尚未接入服务端短链接；请先收束本局或现场展示流程。')
      return
    }
    const url = result.url
    try {
      await navigator.clipboard.writeText(url)
      setShareState('浏览器快照链接已复制：包含当前节点与此前选择；它不是可撤销的服务端长期存档')
    } catch {
      window.prompt('复制这个续玩链接', url)
      setShareState('浏览器快照链接已生成；它不是可撤销的服务端长期存档')
    }
  }

  function generateFrame(frameTurn: number, prompt: string, retry = false) {
    setFrames((value) => value.map((frame) => frame.turn === frameTurn ? { ...frame, status: 'developing' } : frame))
    void generatePortrait(prompt, `${sessionId}-turn-${frameTurn}`, retry).then((result) => {
      setFrames((value) => value.map((frame) => frame.turn === frameTurn
        ? { ...frame, image: result, status: result ? 'ready' : 'unavailable' }
        : frame))
    })
  }

  function speakChapter() {
    if (!voice.configured) {
      setVoiceSettingsOpen(true)
      return
    }
    const reaction = chapter.characterReactions[0]
    const spokenText = reaction?.publicText || chapter.paragraphs[0]
    const speaker = reaction?.characterId === 'mengtian' || reaction?.characterId === 'zhouyu' || reaction?.characterId === 'caocao' ? 'captain' : reaction ? 'partner' : 'narrator'
    void voice.speak(spokenText, speaker, reaction
      ? `这是${spec.title}第${memory.turn + 1}章。角色坚持自己的立场回应玩家，语气符合当前意图“${reaction.intent}”，有戏剧张力但不要播音腔。`
      : `这是${spec.title}第${memory.turn + 1}章的电影旁白。语气自然、有悬念，按句意停顿，不要播音腔。`)
  }

  async function act(action: string) {
    if (loading || !action.trim()) return
    setLoading(true)
    setSelectedAction(action)
    setTurnStage('memory')
    const agentTimer = window.setTimeout(() => setTurnStage('agents'), 650)
    const context = buildStoryTurnContext(memory, action)
    const generated = await generateStoryTurn(context)
    window.clearTimeout(agentTimer)
    setTurnStage('commit')
    const next = generated.chapter || fallbackChapter(spec, memory.turn, action)
    setMode(generated.mode)
    setGenerationNote(generated.mode === 'ai' ? '这一章由在线 Director 根据你的原话与当前世界状态生成。' : `${generated.reason}；当前章节由同一世界规则继续，不会卡住。`)
    const nextLocation = next.stateDelta?.location || memory.currentLocation
    const itemChanges = next.stateDelta?.itemChanges || []
    const committed = commitStoryEvent(memory, {
      turn: memory.turn + 1,
      playerAction: action,
      consequence: next.paragraphs.join(' '),
      characterReactions: next.characterReactions.map((reaction) => `${reaction.characterId}：${reaction.publicText}`),
      location: nextLocation,
      itemChanges: itemChanges.map((item) => `${item.itemId}：${item.status || item.holder || item.purpose || '状态变化'}`),
      itemStateChanges: itemChanges,
      resolvedThreadIds: next.stateDelta?.resolvedThreadIds,
      openedThread: next.newThread,
      actorName,
    })
    setMemory(committed)
    saveStoryMemory(committed)
    setHistory((value) => [...value, { action, chapter: next }].slice(-10))
    setChapter(next)
    setFreeText('')
    const frameTurn = committed.turn
    const prompt = next.imagePrompts[0]
    const pendingFrame: SceneFrame = { turn: frameTurn, title: next.title, prompt, status: prompt ? 'developing' : 'unavailable' }
    setFrames((value) => [...value, pendingFrame].slice(-11))
    setViewingTurn(frameTurn)
    if (prompt && imageEnabled !== false) generateFrame(frameTurn, prompt)
    else if (imageEnabled === false) setFrames((value) => value.map((frame) => frame.turn === frameTurn ? { ...frame, status: 'unavailable' } : frame))
    soundscape.ping('choice')
    if (voiceEnabled && voice.configured) {
      const reaction = next.characterReactions[0]
      const spokenText = reaction?.publicText || next.paragraphs[0]
      const speaker = reaction?.characterId === 'mengtian' || reaction?.characterId === 'zhouyu' || reaction?.characterId === 'caocao' ? 'captain' : reaction ? 'partner' : 'narrator'
      void voice.speak(spokenText, speaker, reaction
        ? `这是${spec.title}第${frameTurn}章。角色坚持自己的立场回应玩家，语气符合当前意图“${reaction.intent}”，有戏剧张力但不要播音腔。`
        : `这是${spec.title}第${frameTurn}章的电影旁白。语气自然、有悬念，按句意停顿，不要播音腔。`)
    }
    setTurnStage('idle')
    setLoading(false)
  }

  const lastEvent = memory.events.at(-1)
  const turnStageIndex = turnStage === 'memory' ? 0 : turnStage === 'agents' ? 1 : turnStage === 'commit' ? 2 : 3

  return <main ref={stageRef} className={`rv-gen-pgc ${cinemaMode ? 'is-cinema' : ''}`}>
    {showPrologue && <section className="rv-pgc-prologue" role="dialog" aria-modal="true" aria-label={`${spec.title}前情提要`}>
      <div className="rv-pgc-prologue__image" style={spec.openingImage ? { backgroundImage: `url(${spec.openingImage})` } : undefined} />
      <div className="rv-pgc-prologue__shade" />
      <article>
        <small>{spec.eyebrow} · 30 秒入戏</small>
        <h1>{spec.title}</h1>
        <p className="rv-pgc-prologue__opening">{spec.opening}</p>
        <div className="rv-pgc-prologue__facts">
          <section><span>你是谁</span><strong>{spec.characters[0]?.id === 'caocao' ? '保留前世记忆的曹操' : spec.characters[0]?.id === 'fusu' ? '身在上郡的扶苏' : '这场冲突中的决策者'}</strong><p>{spec.characters[0]?.goal}</p></section>
          <section><span>眼前危机</span><strong>{spec.fallbackBeats[0]?.title}</strong><p>{spec.fallbackBeats[0]?.background}</p></section>
          <section><span>本局目标</span><strong>让行动留下可追溯后果</strong><p>{spec.stageGoal}</p></section>
        </div>
        <div className="rv-pgc-prologue__items" aria-label="开场关键物件">
          {spec.items.slice(0, 3).map((item) => <div key={item.id}><b>{item.name}</b><span>{item.status}</span><p>用途：{item.purpose}</p></div>)}
        </div>
        <div className="rv-pgc-prologue__actions"><button type="button" onClick={() => setShowPrologue(false)}>普通模式开始</button><button type="button" className="is-primary" onClick={() => void enterCinema()}>全屏进入第一幕 →</button></div>
      </article>
    </section>}
    {cinemaMode && <section className="rv-pgc-cinema" aria-label={`${spec.title}沉浸式剧情`}>
      <div className={`rv-pgc-cinema__backdrop is-${visibleFrame.status}`}>
        {visibleFrame.image ? <img src={visibleFrame.image} alt="" /> : spec.openingImage ? <img src={spec.openingImage} alt="" /> : <i />}
      </div>
      <div className="rv-pgc-cinema__gradient" />
      <header><button type="button" onClick={() => void leaveCinema()}>← 退出全屏</button><span>{spec.title}</span><small>第 {memory.turn + 1} 章 · {memory.currentLocation}</small></header>
      <div className="rv-pgc-cinema__story">
        <small>{loading ? (turnStage === 'memory' ? '正在读取已经发生的事实…' : turnStage === 'agents' ? '人物正在按各自立场回应…' : '正在提交不可逆后果…') : chapter.title}</small>
        <p>{chapter.paragraphs.join(' ')}</p>
        {chapter.characterReactions[0] && <blockquote><b>{chapter.characterReactions[0].characterId}</b>：{chapter.characterReactions[0].publicText}</blockquote>}
      </div>
      <div className="rv-pgc-cinema__choices" aria-label="画面内剧情选择">
        {chapter.suggestedActions.map((action) => <button key={`cinema-${action.id}`} disabled={loading} onClick={() => void act(action.title)}><strong>{action.title}</strong><small>{action.intent}</small></button>)}
        <form onSubmit={(event) => { event.preventDefault(); void act(freeText) }}><input aria-label="全屏模式自由行动" value={freeText} disabled={loading} onChange={(event) => setFreeText(event.target.value)} placeholder="或者直接说你想做什么…" /><button type="submit" disabled={!freeText.trim() || loading}>让世界回应</button></form>
        {endingAvailable && <button type="button" onClick={openEnding}><strong>收束本局，看见结局</strong><small>不强制结束；现在回看选择、人物与可迁移启发</small></button>}
      </div>
      <div className="rv-pgc-cinema__media"><span>{visibleFrame.status === 'developing' ? 'AI 镜头显影中，先继续读剧情' : mode === 'ai' ? '在线世界生成' : mode === 'fallback' ? '世界规则可靠续演' : '世界已就绪'}</span><button type="button" onClick={soundscape.toggle} disabled={!soundscape.supported}>{soundscape.enabled ? '声景开' : '声景关'}</button><button type="button" onClick={speakChapter} disabled={voice.playing || voice.preparing}>{voice.playing ? '配音中' : '朗读'}</button></div>
    </section>}
    <header><button onClick={onExit}>← 内容实验室</button><div><small>{spec.eyebrow}</small><strong>{spec.title}</strong></div><div className="rv-gen-pgc__media"><span>第 {memory.turn + 1} 章 · {mode === 'ready' ? '世界就绪' : mode === 'ai' ? 'AI 续章' : '可靠兜底'}</span><button type="button" onClick={() => void shareCurrentBranch()}>分享续玩</button><button type="button" className={soundscape.enabled ? 'is-on' : ''} onClick={soundscape.toggle} disabled={!soundscape.supported}>声景 {soundscape.enabled ? '已开启' : '开启'}</button><button type="button" className={voiceEnabled ? 'is-on' : ''} onClick={() => { if (!voice.configured) setVoiceSettingsOpen(true); else setVoiceEnabled((value) => !value) }}>自动配音 {voiceEnabled ? '已开启' : '开启'}</button><button type="button" onClick={speakChapter} disabled={voice.playing || voice.preparing}>{voice.preparing ? '配音准备中…' : voice.playing ? '正在播放…' : '▶ 朗读本章'}</button></div></header>
    <section className="rv-gen-pgc__layout">
      <aside className="rv-gen-pgc__world"><small>当前目标</small><h2>{memory.stageGoal}</h2><b>{memory.currentLocation}</b>{shareState && <p role="status" className="rv-gen-pgc__share-status">{shareState}</p>}<details className="rv-gen-pgc__path" open={Boolean(imported)}><summary>本局选择流程 · {memory.turn} 步</summary><ol><li><b>序章</b><span>{spec.fallbackBeats[0].location}</span></li>{memory.events.map((event) => <li key={event.turn}><b>{event.playerAction}</b><span>{event.actorName || '匿名玩家'} · {event.location}</span></li>)}</ol></details><h3>关键物件</h3>{memory.items.map((item) => <article key={item.id}><strong>{item.name}</strong><span>{item.holder} · {item.status}</span><p>{item.purpose}</p></article>)}<h3>未解伏笔</h3>{memory.threads.filter((thread) => thread.status === 'open').map((thread) => <p key={thread.id}>◇ {thread.summary}</p>)}</aside>
      <article className="rv-gen-pgc__chapter">
        <div className="rv-gen-pgc__visual-toolbar"><button type="button" onClick={() => setSceneCollapsed((value) => !value)} aria-expanded={!sceneCollapsed}>{sceneCollapsed ? '▣ 展开画面' : '▱ 收起画面'}</button><span>{sceneCollapsed ? '阅读模式：只看剧情与选择' : `第 ${visibleFrame.turn + 1} 章镜头，生成中不阻塞阅读`}</span></div>
        {!sceneCollapsed && <div className={`rv-gen-pgc__visual is-${visibleFrame.status}`}>{visibleFrame.image ? <img src={visibleFrame.image} alt={`第${visibleFrame.turn + 1}章剧情画面：${visibleFrame.title}`} /> : <div><span>{visibleFrame.status === 'developing' ? '本章 AI 镜头正在显影' : '本章以文字与声景演出'}</span><small>{visibleFrame.status === 'developing' ? '可先阅读剧情，生成完成后自动替换；上一镜头保留在下方。' : imageEnabled === false ? '本次运行没有图像模型，已明确降级；之前的镜头仍可回看。' : '图像不可用不会阻塞选择，你可以立即重试。'}</small>{visibleFrame.prompt && visibleFrame.status === 'unavailable' && imageEnabled !== false && <button type="button" onClick={() => generateFrame(visibleFrame.turn, visibleFrame.prompt!, true)}>重试生成本章镜头</button>}</div>}</div>}
        {!sceneCollapsed && <nav className="rv-gen-pgc__filmstrip" aria-label="章节镜头胶片">
          {frames.map((frame) => <button key={frame.turn} className={frame.turn === visibleFrame.turn ? 'is-active' : ''} onClick={() => setViewingTurn(frame.turn)} aria-label={`查看第${frame.turn + 1}章镜头：${frame.title}`}>
            <span>{frame.image ? <img src={frame.image} alt="" /> : frame.status === 'developing' ? '显影中' : '文字章'}</span><small>第 {frame.turn + 1} 章<br />{frame.title}</small>
          </button>)}
        </nav>}
        <div className="rv-gen-pgc__chapter-head"><small>上一行动：{history.at(-1)?.action || lastEvent?.playerAction || '进入世界'}</small><button type="button" onClick={() => void enterCinema()}>⛶ 影院模式</button></div>{generationNote && <p className={`rv-gen-pgc__generation-note is-${mode}`} role="status">{generationNote}</p>}<h1>{chapter.title}</h1>
        {lastEvent && <section className="rv-gen-pgc__turn-receipt" aria-label="本回合直接后果"><header><small>第 {lastEvent.turn} 回合 · 你的行动已经写入世界</small><strong>{lastEvent.playerAction}</strong></header><div><article><small>马上发生</small><p>{chapter.paragraphs[0]}</p></article><article><small>人物反应</small><p>{chapter.characterReactions[0]?.publicText || '相关人物保留了自己的判断，没有因玩家行动立刻改变立场。'}</p></article><article><small>世界状态</small><p>{lastEvent.itemChanges[0] || (lastEvent.location !== memory.events.at(-2)?.location ? `地点变为：${lastEvent.location}` : `仍在${lastEvent.location}，权威物件没有被凭空改写`)}</p></article></div></section>}
        {chapter.paragraphs.map((paragraph, index) => <p key={`${memory.turn}-${index}`}>{paragraph}</p>)}
        {chapter.characterReactions.map((reaction) => <blockquote key={reaction.characterId}><b>{reaction.characterId}</b>：{reaction.publicText}<small>行动意图：{reaction.intent}</small></blockquote>)}
        {loading && <div className="rv-gen-pgc__loading" role="status"><strong>{turnStage === 'memory' ? '正在读取权威记忆' : turnStage === 'agents' ? '角色正在按自己的立场推演' : '正在校验并提交真实后果'}</strong><ol>{['读取人物、物件与未解伏笔','相关角色形成有限知识下的回应','Director 校验人物与物件 ID','提交新剧情与动态选项'].map((label, index) => <li key={label} className={index < turnStageIndex ? 'is-done' : index === turnStageIndex ? 'is-active' : ''}><i />{label}</li>)}</ol><small>图片和配音随后异步生成，不会阻塞新的选择。</small></div>}
        {endingOpen ? <section className="rv-pgc-ending" aria-label="本局主动结局">
          <small>ENDING AVAILABLE · 由你主动收束，不是回合数强制结算</small>
          <h2>{spec.id.startsWith('caocao-') ? '你改变了历史，也暴露了自己愿意付出的代价。' : spec.id.startsWith('fusu-') ? '你没有让忠诚替代复核，也没有让复核逃避责任。' : '你把不可能任务拆成了条件、他人反应与退出窗口。'}</h2>
          <p>这不是标准答案。它只总结这条世界线实际发生的事：你完成了 {memory.turn} 次行动，抵达 {memory.currentLocation}，让 {memory.items.filter((item) => item.lastChangedTurn > 0).length} 件关键物件留下状态变化，并留下 {memory.threads.filter((thread) => thread.status === 'open').length} 条仍未解决的后果。</p>
          <div><article><small>你反复采用的方式</small><strong>{memory.events.at(-1)?.playerAction || '先观察再行动'}</strong><p>最近的行动不是被系统改写的按钮含义，而是这条分支真实提交的选择。</p></article><article><small>角色没有替你决定</small><strong>{chapter.characterReactions[0]?.publicText || '相关人物仍保留自己的立场'}</strong><p>人物只依据自己的目标和有限知识回应，所以拒绝、怀疑与合作都可能继续存在。</p></article><article><small>带回现实的问题</small><strong>{spec.id.startsWith('caocao-') ? '如果不再依赖“我已经知道结局”，你下一步最需要重新核实什么？' : spec.id.startsWith('fusu-') ? '面对来源异常且后果不可逆的命令，谁能提供第二条独立复核链？' : '哪些准备可控，哪些他人反应只能试探，什么信号出现时必须撤回？'}</strong><p>把它改写成一个 24 小时内可开始、失败也能退出的小行动，而不是照搬游戏答案。</p></article></div>
          <section className="rv-pgc-ending-film" aria-label="生成本局电影回响">
            <div><small>SEEDANCE 2.0 · 本局真实分支</small><strong>把你走过的选择生成 15 秒电影回响</strong><p>使用本局地点和行动摘要生成；角色、物件和世界保持连续。任务在后台进行，不会阻塞回看或继续改写。</p></div>
            {seedanceTask?.videoUrl && seedanceStatus === 'succeeded'
              ? <video src={seedanceTask.videoUrl} controls playsInline preload="metadata" aria-label={`${spec.title}本局电影回响`} />
              : <div className="rv-pgc-ending-film__controls">{seedanceStatus === 'queued' || seedanceStatus === 'running'
                ? <><span role="status">{seedanceStatus === 'queued' ? '镜头已排队，正在建立角色与世界连续性…' : '正在生成本局电影回响…'}</span><button type="button" onClick={() => { seedanceAbortRef.current?.abort(); setSeedanceStatus('idle') }}>停止等待</button></>
                : <button type="button" onClick={() => void generateEndingFilm()}>{seedanceStatus === 'failed' ? '重新生成电影回响' : '生成本局电影回响'}</button>}{seedanceError && <span role="alert">{seedanceError}</span>}</div>}
          </section>
          <footer><button type="button" onClick={() => setEndingOpen(false)}>回看这条世界线</button><button type="button" onClick={() => { setEndingOpen(false); setContinuedBeyondCanon(true) }}>结局之后继续改写世界</button><button type="button" onClick={onExit}>完成体验 →</button></footer>
        </section> : <><div className="rv-gen-pgc__choices">{chapter.suggestedActions.map((action) => <button key={action.id} className={loading && selectedAction === action.title ? 'is-selected' : ''} disabled={loading} onClick={() => act(action.title)}><strong>{action.title}</strong><small>{action.intent}</small></button>)}</div><form onSubmit={(event) => { event.preventDefault(); void act(freeText) }}><textarea aria-label="输入任何你想做的行动" value={freeText} disabled={loading} onChange={(event) => setFreeText(event.target.value)} placeholder={`不必选按钮。直接说你想做什么，例如：${spec.freeActionExample}`} /><button type="button" className={speech.listening ? 'is-listening' : ''} onClick={speech.toggle} disabled={!speech.supported || loading} aria-label={speech.listening ? '停止语音行动' : '说出自由行动'}>🎙 {speech.listening ? '正在听' : '说行动'}</button><button disabled={!freeText.trim() || loading}>{loading ? '世界回应中…' : '让世界回应 →'}</button></form>{endingAvailable && <section className="rv-pgc-ending-fork" aria-label="本局结局选择"><div><small>{continuedBeyondCanon ? '世界仍在运行' : '十个关键节点已走完'}</small><strong>{continuedBeyondCanon ? '你选择了在结局之后继续承担后果。' : '现在可以收束，也可以继续。回合数不会替你决定。'}</strong></div><button type="button" onClick={openEnding}>主动收束本局，查看启发 →</button></section>}</>}{speech.error && <small role="alert">{speech.error}</small>}{voice.error && <small role="alert">最近一次配音失败：{voice.error}</small>}
      </article>
    </section>
    {voiceSettingsOpen && <MimoVoiceSettings configured={voice.configured} serverConfigured={voice.serverConfigured} hasSessionKey={voice.hasSessionKey} error={voice.error} onSave={(key) => { voice.saveSessionKey(key); setVoiceEnabled(true) }} onClear={() => { voice.clearSessionKey(); setVoiceEnabled(false) }} onClose={() => setVoiceSettingsOpen(false)} />}
  </main>
}
