import { useEffect, useMemo, useRef, useState } from 'react'
import { clues, eventTemplates, locations, npcs, WORLD_TITLE, createInitialWorldState } from './content'
import { getAvailableQuickActions, interpretFreeText, resolveTurn } from './engine'
import { createNarrator, generatePortrait, ResilientNarrator } from './narrator'
import { decideSafetyRoute, type SafetyDecision } from './safety'
import type { ClueId, PlayerAction, QuickAction, TurnResult, WorldState } from './types'
import { useSpeechInput } from './useSpeechInput'
import { compileWorld, getWorldAgentBrief, personalizeWorld, type CompiledWorld } from './worldCompiler'
import { classicBeats, type ClassicChoiceId } from './classicStory'
import { requestCharacterActions } from './characterAgents'
import { clearMirrorSession, loadMirrorSession, saveMirrorSession } from './sessionSnapshot'
import { TypewriterSubtitle } from '../components/TypewriterSubtitle'
import { downloadBlob, renderReelVideo, type ReelShot } from './reelRenderer'
import { buildIntakeQuestions, composeGuidedStory, type IntakeLens } from './intakeGuide'
import { useSoundscape } from './useSoundscape'
import { buildExperienceReceipt } from './experienceReceipt'
import { buildUnderstandingPath } from './understandingPath'
import { fusuBeats } from './fusuStory'
import { GenerativePgcGame } from './GenerativePgcGame'
import { caocaoPgcSpec, classicPgcSpec, fusuPgcSpec } from './pgcSpecs'
import { detectiveBeats } from './detectiveStory'
import { MotionChallenge } from './MotionChallenge'
import type { PhysicalChallengeOutcome } from './MotionChallenge'
import { MimoVoiceSettings } from './MimoVoiceSettings'
import { useMimoVoice } from './useMimoVoice'
import { buildSeedanceDirectorPrompt, createSeedanceTask, getSeedanceTask, type SeedanceTask, type SeedanceTaskStatus } from './seedance'
import { buildLocalReflectionInsight, requestReflectionInsight } from './reflectionInsight'

type RouteId = 'mirror' | 'children' | 'classic'
type Screen = 'landing' | 'generating' | 'receipt' | 'game' | 'reflection' | 'library' | 'caocao' | 'classic' | 'fusu' | 'detective' | 'physical'

const WEATHER_LABEL: Record<WorldState['weather'], string> = { clear: '晴朗', rain: '小雨', fog: '海雾' }
const WORLDLINE_LABEL: Record<WorldState['activeWorldline'], string> = {
  undetermined: '尚未明朗', truth: '真相线', forgetting: '遗忘线',
}
const MIN_REFLECTION_TURNS = 4

const DEFAULT_STORY = '我和同事一起完成了项目，但汇报时他几乎把功劳都说成自己的。我很不爽，又怕直接说会破坏关系。'
const OUTCOMES = ['看清局面', '理解对方', '找到下一步'] as const

const CLUE_GROUPS: Array<{ key: string; label: string; match: (s: WorldState['clues'][ClueId]) => boolean }> = [
  { key: 'new', label: '新发现', match: (s) => s === 'discovered' },
  { key: 'hinted', label: '尚未理清', match: (s) => s === 'hinted' },
  { key: 'connected', label: '已建立连接', match: (s) => s === 'connected' },
  { key: 'resolved', label: '已解决 / 已证伪', match: (s) => s === 'resolved' || s === 'disproved' },
]

function describeTurnImpact(result: TurnResult, world: CompiledWorld): string[] {
  const impact: string[] = []
  if (result.discoveredClueIds.length) impact.push(`发现：${result.discoveredClueIds.map((id) => world.clueCopy[id].name).join('、')}`)
  if (result.unlockedLocationIds.length) impact.push(`解锁：${result.unlockedLocationIds.map((id) => world.locationCopy[id].shortName).join('、')}`)
  if (result.characterActions.length) impact.push(...result.characterActions.map((action) => `${getWorldAgentBrief(world, action.npcId).name}：${action.intent}`))
  if (result.triggeredEvent) {
    const title = world.themeId === 'workplace'
      ? result.triggeredEvent.title
      : result.triggeredEvent.title
        .replaceAll('沈亦舟', world.lexicon.partnerName)
        .replaceAll('阿灯', world.lexicon.witnessName)
        .replaceAll('舰长', world.lexicon.captainName)
    impact.push(`世界变化：${title}`)
  }
  if (!impact.length) impact.push('这条路没有产生新事实；下一回合会换一种问法')
  return impact.slice(0, 3)
}

function describeGoalDelta(before: WorldState, after: WorldState, world: CompiledWorld): string {
  if (!before.flags.ending_reached && after.flags.ending_reached) return after.activeWorldline === 'forgetting'
    ? '结局触发：等待已经替你做出选择；局面被默认翻篇，可以回看这条路径的现实代价'
    : `目标推进：${world.lexicon.process}已经启动，可以把本局方法带回现实`
  if (before.clues.clue_combined_proof === 'hidden' && after.clues.clue_combined_proof !== 'hidden') return `目标推进：两份独立信息已连接，下一步交给${world.lexicon.captainName}复核`
  const beforeEvidence = Object.values(before.clues).filter((status) => status === 'discovered' || status === 'connected' || status === 'resolved').length
  const afterEvidence = Object.values(after.clues).filter((status) => status === 'discovered' || status === 'connected' || status === 'resolved').length
  if (afterEvidence > beforeEvidence) return `目标推进：可核验信息 ${beforeEvidence} → ${afterEvidence}，还需要另一个独立来源`
  if (after.playerLocationId !== before.playerLocationId) return `位置变化：已到${world.locationCopy[after.playerLocationId].shortName}，这里保存着不同来源的信息`
  return '目标未推进：这次没有新增可核验信息，请换地点、对象或行动方式'
}

function displayCharacterAction(world: CompiledWorld, action: TurnResult['characterActions'][number]): string {
  const names = { partner: world.lexicon.partnerName, witness: world.lexicon.witnessName, captain: world.lexicon.captainName }
  if (world.themeId === 'workplace' && !world.generated) return action.publicText
  const copy = action.npcId === 'captain'
    ? `${names.captain}把两份信息分开放好，开始检查它们能证明什么、不能证明什么。`
    : action.npcId === 'witness'
      ? `${names.witness}翻开${world.lexicon.record}，只标出自己能够确认的部分。`
      : `${names.partner}停下争辩，转身去重新查看${world.lexicon.artifact}。`
  return copy
}

function Mark() {
  return <span className="rv-brand-mark" aria-hidden="true"><i /><i /><i /></span>
}

function Landing({ onStart, initialStory = '' }: { onStart: (route: RouteId, story: string, outcome: (typeof OUTCOMES)[number]) => void; initialStory?: string }) {
  // Start empty so dictation and typing are semantically identical. The
  // authored example is opt-in via the example card, never silently mixed into
  // a user's first spoken sentence.
  const [story, setStory] = useState(initialStory)
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>('找到下一步')
  const [safety, setSafety] = useState<SafetyDecision>({ route: 'story' })
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const [guideAnswers, setGuideAnswers] = useState<Partial<Record<IntakeLens, string>>>({})
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [serviceState, setServiceState] = useState<'checking' | 'online' | 'degraded'>('checking')
  const speech = useSpeechInput(setStory)
  const guideQuestions = useMemo(() => buildIntakeQuestions(story).slice(0, 2), [story])

  useEffect(() => {
    let cancelled = false
    fetch('/api/status').then((response) => {
      if (!response.ok) throw new Error('status unavailable')
      return response.json()
    }).then((status) => {
      if (!cancelled) setServiceState(status.aiEnabled ? 'online' : 'degraded')
    }).catch(() => { if (!cancelled) setServiceState('degraded') })
    return () => { cancelled = true }
  }, [])

  function submit() {
    const guidedStory = composeGuidedStory(story, guideAnswers)
    const decision = decideSafetyRoute(guidedStory, 'mirror')
    setSafety(decision)
    if (decision.route === 'story') onStart('mirror', guidedStory, outcome)
  }

  return (
    <main className="rv-home">
      <header className="rv-home__header">
        <a className="rv-brand" href="/" aria-label="回响引擎首页"><Mark /><span>回响引擎</span><small>ECHOFORGE</small></a>
        <div className={`rv-home__nav rv-home__nav--${serviceState}`}><span>{serviceState === 'checking' ? '正在连接世界引擎' : serviceState === 'online' ? 'AI 世界引擎在线' : '可靠本地模式'}</span><a href="/children.html">亲子体验</a></div>
      </header>

      <section className="rv-home__hero">
        <div className="rv-home__copy">
          <p className="rv-home__question">今天，有什么事让你卡住了？</p>
          <h1><span>别急着找答案。</span><em>先进去看看。</em></h1>
          <p className="rv-home__lead">我们把你的困惑编译成一个由多个固定人格角色共同运行的世界。你做出的每个选择，都会留下真实后果。</p>
        </div>

        <form className="rv-story-input" onSubmit={(event) => { event.preventDefault(); submit() }}>
          <div className="rv-story-input__head"><span>讲述一件真实困惑</span><small>不用写真实姓名 · 演示内容不会保存</small></div>
          <textarea aria-label="描述你想探索的事情" value={story} placeholder="例如：我答应朋友参加比赛，但最近身体不舒服；退出怕让他失望，硬撑又担心受伤。" onChange={(event) => setStory(event.target.value)} rows={5} />
          {advancedOpen && <fieldset className="rv-outcome-picker"><legend>这次你更想获得什么？</legend>{OUTCOMES.map((item) => <button key={item} type="button" className={outcome === item ? 'is-selected' : ''} aria-pressed={outcome === item} onClick={() => setOutcome(item)}>{item}</button>)}</fieldset>}
          {guideOpen && <section className="rv-intake-guide" aria-label="引导 Agent 追问">
            <div className="rv-intake-guide__agent"><b>引导 Agent</b><span>我不会替你判断，只补齐生成世界需要的上下文。</span><button type="button" onClick={() => setGuideOpen(false)}>关闭</button></div>
            <label><small>{guideStep + 1} / {guideQuestions.length} · {guideQuestions[guideStep].label}</small><strong>{guideQuestions[guideStep].question}</strong><textarea rows={2} value={guideAnswers[guideQuestions[guideStep].lens] || ''} placeholder={guideQuestions[guideStep].placeholder} onChange={(event) => setGuideAnswers((answers) => ({ ...answers, [guideQuestions[guideStep].lens]: event.target.value }))} /></label>
            <div><button type="button" disabled={guideStep === 0} onClick={() => setGuideStep((value) => Math.max(0, value - 1))}>上一个</button>{guideStep < guideQuestions.length - 1 ? <button type="button" onClick={() => setGuideStep((value) => value + 1)}>下一个问题 →</button> : <button type="button" onClick={submit}>带着这些补充生成世界 →</button>}</div>
          </section>}
          <div className="rv-story-input__actions">
            <div className="rv-story-input__helpers"><button type="button" className={`rv-voice rv-voice--labeled ${speech.listening ? 'is-listening' : ''}`} onClick={speech.toggle} title={speech.supported ? '使用语音输入' : '当前浏览器不支持语音输入'} aria-label={speech.listening ? '停止语音讲述' : '开始语音讲述'} aria-pressed={speech.listening}><b>🎙</b>{speech.listening ? '正在听…' : '语音讲述'}</button><button type="button" className="rv-guide-trigger" aria-expanded={guideOpen} onClick={() => setGuideOpen((value) => !value)}>回答 2 个问题，让故事更贴合</button><button type="button" className="rv-advanced-trigger" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((value) => !value)}>{advancedOpen ? '收起目标' : `目标：${outcome}`}</button></div>
            <span>{speech.listening ? '正在边听边写；你看到的文字会原样进入下一页' : speech.transcribing ? '正在识别录音；结果会原样追加到文本框' : speech.error || '语音与打字完全等价；追问与目标均为可选'}</span>
            <button className="rv-primary" type="submit" disabled={!story.trim()}>开始一场决策排练 <b>→</b></button>
          </div>
          {safety.route !== 'story' && <section className={`rv-safety rv-safety--${safety.route}`} role="alert"><strong>{safety.title}</strong><p>{safety.message}</p><button type="button" onClick={() => setSafety({ route: 'story' })}>返回修改内容</button></section>}
        </form>
      </section>

      <section className="rv-route-rail" aria-label="预制世界包">
        <div className="rv-route-rail__intro"><small>不知道怎么讲？</small><strong>也可以先试玩预制世界</strong><p>它们不是三个不同产品，而是同一套选择—后果—回响引擎。</p></div>
        <button onClick={() => { setStory(DEFAULT_STORY); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><small>示例</small><span><strong>职场选择</strong><em>贡献没有被看见时，怎样核对事实与边界？</em></span><b>↗</b></button>
        <button onClick={() => onStart('classic', '草船借箭：面对“三天十万支箭”的地狱级 KPI，你会怎么破局？', '看清局面')}><small>名著</small><span><strong>草船借箭</strong><em>进入经典冲突，理解人物为何这样选择。</em></span><b>↗</b></button>
        <button onClick={() => { window.location.href = '/children.html' }}><small>亲子</small><span><strong>互动绘本</strong><em>和孩子练习表达感受、愿望与边界。</em></span><b>↗</b></button>
      </section>

      <footer className="rv-home__footer"><span>输入一件事</span><i />进入一场选择排练<i />带走一个可逆的下一步</footer>
    </main>
  )
}

function Generating({ source, route, world, onReady, onCancel }: { source: string; route: RouteId; world: CompiledWorld; onReady: (world: CompiledWorld) => void; onCancel: () => void }) {
  const [step, setStep] = useState(0)
  const [personalized, setPersonalized] = useState<CompiledWorld | null>(null)
  const [finishedAnimation, setFinishedAnimation] = useState(false)
  const readySent = useRef(false)
  const steps = ['识别事实与未知', '构建镜像世界', '写入角色人格宪法', '检查因果与安全边界']

  useEffect(() => {
    const timer = window.setInterval(() => setStep((value) => {
      if (value >= steps.length - 1) { window.clearInterval(timer); window.setTimeout(() => setFinishedAnimation(true), 420); return value }
      return value + 1
    }), 460)
    return () => window.clearInterval(timer)
  }, [steps.length])

  useEffect(() => {
    if (route === 'classic') { setPersonalized(world); return }
    let cancelled = false
    void personalizeWorld(source, world).then((nextWorld) => {
      if (cancelled) return
      setPersonalized(nextWorld)
    })
    return () => { cancelled = true }
  }, [onReady, route, source, world])

  useEffect(() => {
    if (!finishedAnimation || !personalized || readySent.current) return
    readySent.current = true
    onReady(personalized)
  }, [finishedAnimation, onReady, personalized])

  return (
    <main className="rv-generating">
      <button className="rv-generating__back" type="button" onClick={onCancel}>← 返回修改</button>
      <Mark />
      <p>正在把你的故事编译成世界</p>
      <h1>{route === 'classic' ? '江面的大雾已经升起。' : `${personalized?.worldTitle ?? world.worldTitle}已经成形。`}</h1>
      <blockquote>“{source.slice(0, 76)}{source.length > 76 ? '…' : ''}”</blockquote>
      <small className="rv-generating__source-note">以上是本局唯一原始输入；AI 将基于它生成现实分析、场景、人物、线索与行动。</small>
      {route === 'mirror' && <p className="rv-generating__world">{personalized?.metaphor ?? world.metaphor} · {personalized?.conflictFocus ?? world.conflictFocus}</p>}
      <div className="rv-generating__steps">
        {steps.map((label, index) => <span key={label} className={index < step ? 'is-done' : index === step ? 'is-current' : ''}><i>{index < step ? '✓' : index + 1}</i>{label}</span>)}
      </div>
      <div className="rv-generating__progress" role="progressbar" aria-label="世界生成进度" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={Math.min(step + (personalized ? 1 : 0), steps.length)}><i style={{ width: `${Math.min(100, ((step + (personalized ? 1 : 0)) / steps.length) * 100)}%` }} /></div>
      <small className="rv-generating__mode">{personalized?.generated ? '✓ 本局角色、隐喻与目标已按你的内容生成' : step === steps.length - 1 ? '正在完成本局个性化；超时会自动使用可靠世界骨架' : '模型提案 · 规则引擎校验'}</small>
    </main>
  )
}

function ContentLibrary({ onChoose, onExit }: { onChoose: (pack: 'caocao' | 'classic' | 'fusu' | 'detective' | 'physical') => void; onExit: () => void }) {
  const packs = [
    { id: 'caocao' as const, label: '旗舰开放历史世界', title: '重回刺董之夜', length: '前 10 轮重点打磨', description: '你是保留前世记忆的曹操。刺杀暴露，吕布将至；人物只按各自所知与欲望行动，历史一旦发生便不可读档。' },
    { id: 'classic' as const, label: '名著 WHAT-IF', title: '草船借箭', length: '12 次选择', description: '在原作事实约束下，体验周瑜、诸葛亮、鲁肃与曹操不同的风险偏好。' },
    { id: 'fusu' as const, label: '历史推演', title: '魂穿扶苏', length: '10 次选择', description: '面对来源异常、后果不可逆的诏令，练习权限、证据链与退出条件。' },
    { id: 'physical' as const, label: '家庭 AI 具身剧场', title: '十秒接住吕布', length: '摄像头体感', description: '无需硬件或道具。MediaPipe 在本机识别架挡骨骼，成功与失误进入不同协作剧情。' },
  ]
  return <main className="rv-library"><header><button onClick={onExit}>← 回响引擎</button><div className="rv-brand"><Mark /><span>内容实验室</span><small>ECHOFORGE PGC</small></div><span>{packs.length} 个完整可玩包</span></header><section><small>选择一场认知实验</small><h1>不是换皮故事。<br /><em>每一局都有可见的结局条件。</em></h1><p>主推内容都使用同一套开放世界记忆、角色立场与因果后果；最后展示本局真实选择和可迁移的方法。</p><div className="rv-library__grid">{packs.map((pack) => <button key={pack.id} onClick={() => onChoose(pack.id)}><small>{pack.label} · {pack.length}</small><strong>{pack.title}</strong><p>{pack.description}</p><span>开始体验 →</span></button>)}</div></section></main>
}

export function PhysicalTheater({ onExit }: { onExit: () => void }) {
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [outcome, setOutcome] = useState<PhysicalChallengeOutcome | null>(null)
  const [voiceSettings, setVoiceSettings] = useState(false)
  const voice = useMimoVoice()
  const voiceConfigured = voice.configured
  const speakVoice = voice.speak
  const result = useMemo(() => outcome === 'guarded'
    ? { title: '你接住了第一戟。', text: '刀锋压下来的瞬间，你的架挡没有散。关羽顺势贴近吕布中线，张飞从侧翼封住退路。三人的信任不是来自口号，而是你在限定时间里完成了可验证的动作。', relation: '关羽信任 +12 · 张飞协作意愿 +8', next: '下一幕：由谁承担第二次风险？' }
    : outcome
      ? { title: '你慢了半拍，但故事没有判你失败。', text: '戟锋逼近时，你的双臂还没有完全展开。关羽替你卸开力道，张飞抢前一步挡住追击。队伍保住了阵线，却也看见了一个事实：下一次行动不能继续依赖没有说清的默契。', relation: '关羽保护倾向 +10 · 队伍风险 +6', next: '下一幕：明确口令，还是改变站位？' }
      : null, [outcome])

  useEffect(() => {
    if (!result || !voiceConfigured) return
    void speakVoice(result.text, 'captain', outcome === 'guarded' ? '战场余震未散，声音低沉坚定，先短促肯定，再放慢解释协作意义。' : '刚经历惊险，先压住喘息，语气不责备，但清楚指出下一次必须改变什么。')
  }, [outcome, result, speakVoice, voiceConfigured])

  return <main className="rv-physical-pack">
    <header><button onClick={onExit}>← 内容实验室</button><div className="rv-brand"><Mark /><span>家庭 AI 具身剧场</span><small>CAMERA ONLY · NO HARDWARE</small></div><button onClick={() => setVoiceSettings(true)}>{voice.configured ? 'MiMo 情绪配音已启用' : '配置 MiMo 情绪配音'}</button></header>
    <section className="rv-physical-pack__stage"><div><video className="rv-physical-pack__video" src="/videos/hulao-guard-opening.mp4" autoPlay loop muted playsInline poster="/cover.png" aria-label="Seedance 生成的虎牢关开场镜头" /><div className="rv-physical-pack__veil" /><small>虎牢关 · 三英战吕布 · Seedance 2.0 开场</small><h1>{result?.title || '吕布的第一戟，冲你来了。'}</h1><p>{result?.text || '这一幕不需要手柄、ESP32 或 3D 打印。电脑摄像头会在本地识别你的上半身骨骼。你有十秒调整站位并做出架挡；无论成功还是失误，角色都会依据自己的性格采取不同动作。'}</p>{result ? <><strong>{result.relation}</strong><em>{result.next}</em><div><button onClick={() => { setOutcome(null); setChallengeOpen(true) }}>换一种结果再试</button><button onClick={onExit}>完成体验 →</button></div></> : <button className="rv-primary" onClick={() => setChallengeOpen(true)}>进入战场，开启摄像头 →</button>}</div><aside><span>关羽</span><blockquote>“先稳住中线，再谈胜负。”</blockquote><span>张飞</span><blockquote>“你若迟疑，我先顶上；但下一回合要把口令喊清。”</blockquote><span>吕布</span><blockquote>“十秒。站稳了，让我看看你们能不能接住。”</blockquote></aside></section>
    {challengeOpen && <MotionChallenge onClose={() => setChallengeOpen(false)} onComplete={(next) => { setChallengeOpen(false); setOutcome(next) }} />}
    {voiceSettings && <MimoVoiceSettings configured={voice.configured} serverConfigured={voice.serverConfigured} hasSessionKey={voice.hasSessionKey} error={voice.error} onSave={voice.saveSessionKey} onClear={voice.clearSessionKey} onClose={() => setVoiceSettings(false)} />}
  </main>
}

export function FusuGame({ onExit }: { onExit: () => void }) {
  const [beat, setBeat] = useState(0)
  const [choices, setChoices] = useState<string[]>([])
  const current = fusuBeats[beat]
  const selected = current.choices.find((choice) => choice.id === choices[beat])
  const finished = choices.length === fusuBeats.length
  function choose(id: string) { setChoices((value) => [...value.slice(0, beat), id]) }
  return <main className="rv-linear-pack rv-linear-pack--fusu"><header><button onClick={onExit}>← 内容实验室</button><div className="rv-brand"><Mark /><span>魂穿扶苏</span><small>史实 · 互动假设</small></div><span>{beat + 1} / {fusuBeats.length}</span></header><section className="rv-linear-pack__hero"><small>{current.location} · 本幕视角：{current.speaker}</small><h1>{finished ? '你保留了一次复核的可能。' : current.prompt}</h1><div className="rv-linear-pack__progress" aria-label={`结局进度 ${choices.length}/${fusuBeats.length}`}>{fusuBeats.map((_, index) => <i key={index} className={index < choices.length ? 'is-done' : ''} />)}</div></section><section className="rv-linear-pack__body"><aside><span>可核对的史实背景</span><p>{current.history}</p><span>互动假设，不冒充史实</span><p>{current.hypothesis}</p></aside><div>{!selected ? <div className="rv-linear-pack__choices">{current.choices.map((choice) => <button key={choice.id} onClick={() => choose(choice.id)}><strong>{choice.title}</strong><small>{choice.consequence}</small></button>)}</div> : beat < fusuBeats.length - 1 ? <article className="rv-linear-pack__result"><small>✓ 选择立即生效</small><h2>{selected.title}</h2><p>{selected.consequence}</p><button onClick={() => setBeat((value) => value + 1)}>进入下一幕 →</button></article> : <article className="rv-linear-pack__ending"><small>结局已触发 · {choices.length} / {fusuBeats.length}</small><h2>不可逆之前，先保留复核路径</h2><p>{selected.consequence}</p><p>真实历史没有被改写。本局启发是：来源异常且结果不可逆时，先核权限与独立来源，隔离旁观者代价，并为复核设置明确期限。</p><ol aria-label={`本局${choices.length}次选择`}>{choices.map((id, index) => { const choice = fusuBeats[index].choices.find((item) => item.id === id)!; return <li key={id}>第 {index + 1} 幕 · {choice.title}</li> })}</ol><button onClick={onExit}>完成体验，返回内容库</button></article>}</div></section></main>
}

export function DetectiveGame({ onExit }: { onExit: () => void }) {
  const [beat, setBeat] = useState(0)
  const [choices, setChoices] = useState<string[]>([])
  const current = detectiveBeats[beat]
  const selected = current.choices.find((choice) => choice.id === choices[beat])
  function choose(id: string) { setChoices((value) => [...value.slice(0, beat), id]) }
  return <main className="rv-linear-pack rv-linear-pack--detective"><header><button onClick={onExit}>← 内容实验室</button><div className="rv-brand"><Mark /><span>雾港谜案</span><small>原创案件 · 非既有 IP</small></div><span>{beat + 1} / {detectiveBeats.length}</span></header><section className="rv-linear-pack__hero"><small>地点 {beat + 1} / {detectiveBeats.length} · {current.location}</small><h1>{current.title}</h1><p>{current.prompt}</p><div className="rv-linear-pack__progress" aria-label={`结局进度 ${choices.length}/${detectiveBeats.length}`}>{detectiveBeats.map((_, index) => <i key={index} className={index < choices.length ? 'is-done' : ''} />)}</div></section><section className="rv-linear-pack__body"><aside><span>这条证据能证明</span><p>{current.evidence}</p><span>它不能证明</span><p>{current.cannotProve}</p></aside><div>{!selected ? <div className="rv-linear-pack__choices">{current.choices.map((choice) => <button key={choice.id} onClick={() => choose(choice.id)}><strong>{choice.title}</strong><small>{choice.consequence}</small><em>{choice.method}</em></button>)}</div> : beat < detectiveBeats.length - 1 ? <article className="rv-linear-pack__result"><small>✓ 选择立即生效</small><h2>{selected.title}</h2><p>{selected.consequence}</p><button onClick={() => setBeat((value) => value + 1)}>前往下一地点 →</button></article> : <article className="rv-linear-pack__ending"><small>案件结局已触发 · {choices.length} / {detectiveBeats.length}</small><h2>馆长获救，动机仍待核验</h2><p>{selected.consequence}</p><p>本局启发：证据足够支持有限行动时，不必等所有未知消失；但也不要用一个完整坏人故事填补证据边界。</p><ol aria-label={`本局${choices.length}次选择`}>{choices.map((id, index) => { const choice = detectiveBeats[index].choices.find((item) => item.id === id)!; return <li key={id}>{detectiveBeats[index].location} · {choice.title}</li> })}</ol><button onClick={onExit}>完成体验，返回内容库</button></article>}</div></section></main>
}

type SceneStage = 'opening' | 'turning' | 'connected' | 'ending'

function HarborScene({ weather, portrait, label, locationId, stage }: { weather: WorldState['weather']; portrait?: string; label: string; locationId: WorldState['playerLocationId']; stage: SceneStage }) {
  if (portrait) return <img className="rv-scene-card__art" src={portrait} alt="当前世界场景" />
  return (
    <div className={`rv-harbor rv-harbor--${weather} rv-harbor--${locationId} rv-harbor--${stage}`} role="img" aria-label={`${label}的${locationId}场景，剧情阶段${stage}`}>
      <div className="rv-harbor__moon" /><div className="rv-harbor__fog rv-harbor__fog--one" /><div className="rv-harbor__fog rv-harbor__fog--two" />
      <div className="rv-harbor__mountain" /><div className="rv-harbor__interior"><i /><b /><span /></div><div className="rv-harbor__tower"><i /><b /></div>
      <div className="rv-harbor__ship"><i /><b /><span /></div><div className="rv-harbor__water" />
    </div>
  )
}

function WorldReceipt({ source, desiredOutcome, world, onConfirm, onRevise }: { source: string; desiredOutcome: (typeof OUTCOMES)[number]; world: CompiledWorld; onConfirm: () => void; onRevise: () => void }) {
  const receipt = buildExperienceReceipt(source, world)
  const reality = world.realWorldAnalysis
  const cards = [
    { number: '01', label: '你报告的情境', value: receipt.reportedFact, tone: 'fact' },
    { number: '02', label: '可能正在发生的感受', value: receipt.feeling, tone: 'feeling' },
    { number: '03', label: '我们不会替你猜的部分', value: receipt.unknown, tone: 'unknown' },
  ]
  return (
    <main className="rv-receipt">
      <header><button className="rv-brand" onClick={onRevise}><Mark /><span>回响引擎 EchoForge</span></button><small>世界编译回执 · 进入前可修改</small></header>
      <section className="rv-receipt__hero">
        <div><small>YOUR EXPERIENCE, COMPILED</small><h1>先不急着解释。<br />看看我们<em>理解对了吗？</em></h1><p>这不是诊断，也不是替你判断谁对谁错。系统只把你的叙述拆成可探索的部分，再交给一个由固定人格角色运行的世界。</p></div>
        <aside><span>本局镜像世界</span><strong>{world.worldTitle}</strong><p>{world.metaphor}</p><small>{world.generated ? 'AI 生成提案 · 因果规则已校验' : '可靠世界骨架 · 可完整离线降级'}</small></aside>
      </section>
      <section className="rv-receipt__reality" aria-label="对现实处境的直接理解">
        <article><small>先不讲寓言，直接回应你的问题</small><h2>{reality.situationSummary}</h2><p>{reality.emotionalAcknowledgement}</p></article>
        <aside><small>你希望这次排练帮助你：{desiredOutcome}</small><p>{reality.coreConflict}</p></aside>
      </section>
      <blockquote className="rv-receipt__source"><small>你刚才输入的原文 · 语音与打字完全等价</small>“{source}”</blockquote>
      <section className="rv-receipt__cards">
        {cards.map((card) => <article key={card.number} className={`rv-receipt-card rv-receipt-card--${card.tone}`}><small>{card.number} · {card.label}</small><p>{card.value}</p></article>)}
      </section>
      <section className="rv-receipt__mapping" aria-label="现实问题与剧情的对应关系">
        <header><small>所以，这个剧情到底是什么？</small><h2>它不是换皮故事，而是把现实里混在一起的三件事拆开试。</h2></header>
        <ol>
          <li><span>现实冲突</span><strong>{world.conflictFocus}</strong><p>{reality.coreConflict}</p></li>
          <li><span>剧情映射</span><strong>{world.metaphor}</strong><p>它代表眼前需要核对的规则、条件与代价；不是在暗示谁是好人或坏人。</p></li>
          <li><span>你在局里要做的事</span><strong>{world.objectiveTitle}</strong><p>分别听当事人、有限事实和规则边界，再看不同选择会保留或牺牲什么。</p></li>
        </ol>
      </section>
      <section className="rv-receipt__experiment">
        <div><small>这一局不是寻找标准答案，而是做一个认知实验</small><h2>{world.openingQuestion}</h2><p>{receipt.experiment}</p></div>
        <ol>{(['partner', 'witness', 'captain'] as const).map((id) => { const agent = getWorldAgentBrief(world, id); return <li key={id}><span>{npcs[id].portraitSymbol}</span><div><strong>{agent.name}</strong><small>{agent.principle}</small></div></li> })}</ol>
      </section>
      <footer><button onClick={onRevise}>← 有些不对，返回重述</button><button className="rv-primary" onClick={onConfirm}>理解正确，进入世界 <b>→</b></button></footer>
    </main>
  )
}

export function Reflection({ state, source, world, onBack, onRestart }: { state: WorldState; source: string; world: CompiledWorld; onBack: () => void; onRestart: () => void }) {
  const [reelOpen, setReelOpen] = useState(false)
  const [renderingReel, setRenderingReel] = useState(false)
  const [reelError, setReelError] = useState('')
  const [seedanceStatus, setSeedanceStatus] = useState<SeedanceTaskStatus>('idle')
  const [seedanceTask, setSeedanceTask] = useState<SeedanceTask | null>(null)
  const [seedanceError, setSeedanceError] = useState('')
  const seedanceAbortRef = useRef<AbortController | null>(null)
  const localInsight = useMemo(() => buildLocalReflectionInsight(source, state, world), [source, state, world])
  const [reflectionInsight, setReflectionInsight] = useState(localInsight)
  const [insightLoading, setInsightLoading] = useState(true)
  const found = Object.values(state.clues).filter((status) => status !== 'hidden' && status !== 'hinted').length
  const talked = Object.values(state.npcStates).filter((npc) => npc.hasMetPlayer).map((npc) => getWorldAgentBrief(world, npc.npcId).name)
  const actionCounts = Object.entries(state.actionCounts)
  const investigateCount = actionCounts.filter(([key]) => key.startsWith('investigate:') || key.startsWith('observe:')).reduce((sum, [, count]) => sum + count, 0)
  const talkCount = actionCounts.filter(([key]) => key.startsWith('talk:')).reduce((sum, [, count]) => sum + count, 0)
  const repeated = actionCounts.find(([, count]) => count > 1)
  const insight = found >= 2
    ? `你用 ${investigateCount} 次观察或核对，把“${world.conflictFocus}”拆成了 ${found} 条可以分别检验的信息。`
    : talkCount > 0
      ? `你先听了 ${talked.join('、') || '世界中的人'}的视角，然后才决定要不要继续追问。`
      : `你没有立刻替“${world.conflictFocus}”下结论，而是先确认了 ${found} 条信息；这正是在实践“${world.reflectionLens}”。`
  const unknown = state.activeWorldline === 'forgetting'
    ? '事情被默认翻篇，不代表你的感受或判断被证伪；真正未知的是，如果你当时只推进一小步，关系与结果是否会不同。'
    : state.flags.proof_presented
      ? `当前信息足以推进“${world.lexicon.process}”，但仍不能保证${world.lexicon.outcome}会按你期待的方式结束。`
    : talked.length
      ? `${talked.join('、')}提供了自己的视角，但你还缺少能被第三方复核的完整记录。`
      : '你还没有听见其他人的视角；眼前的信息还不足以判断动机。'
  const nextAction = state.flags.proof_presented
    ? world.reversibleAction
    : state.activeWorldline === 'forgetting'
      ? `先不追求一次说清。只做一个十分钟内可完成、随时能撤回的动作：${world.reversibleAction}`
    : investigateCount > 0
      ? `${world.reversibleAction} 你已经完成了第一轮信息核对，下一步只补一个独立来源，不必一次做完。`
      : world.reversibleAction
  const reelShots: ReelShot[] = [
    { title: '现实来信', visual: source, subtitle: `你带着“${world.conflictFocus}”进入了${world.worldTitle}。`, meaning: '把困惑放到安全距离外观察' },
    ...state.log.filter((entry) => entry.kind === 'narration' && entry.turn > 0).slice(0, 3).map((entry) => ({
      title: `第 ${entry.turn} 幕 · ${world.chapterTitles[Math.min(entry.turn - 1, 3)]}`,
      visual: entry.text.slice(0, 84),
      subtitle: entry.text.slice(0, 120),
      meaning: entry.turn <= 1 ? '先行动，再判断' : entry.turn <= 3 ? '让独立信息彼此核对' : '让选择留下可解释的后果',
    })),
    { title: '把回响带回现实', visual: unknown, subtitle: nextAction, meaning: '保留未知，只做一个可逆的小行动' },
  ]
  const understandingPath = buildUnderstandingPath(source, state, world)

  useEffect(() => () => seedanceAbortRef.current?.abort(), [])
  useEffect(() => {
    let cancelled = false
    setReflectionInsight(localInsight)
    setInsightLoading(true)
    requestReflectionInsight(source, state, world).then((personalized) => {
      if (!cancelled && personalized) setReflectionInsight(personalized)
    }).finally(() => { if (!cancelled) setInsightLoading(false) })
    return () => { cancelled = true }
  }, [localInsight, source, state, world])

  function buildSeedancePrompt() {
    return buildSeedanceDirectorPrompt({
      worldTitle: world.worldTitle,
      conflictFocus: world.conflictFocus,
      shots: reelShots.map(({ title, meaning }) => ({ title, meaning })),
    })
  }

  async function generateSeedanceReel() {
    seedanceAbortRef.current?.abort()
    const controller = new AbortController()
    seedanceAbortRef.current = controller
    setSeedanceError('')
    setSeedanceTask(null)
    setSeedanceStatus('queued')
    try {
      let task = await createSeedanceTask(buildSeedancePrompt(), controller.signal)
      setSeedanceTask(task)
      setSeedanceStatus(task.status)
      while (!controller.signal.aborted && task.status !== 'succeeded' && task.status !== 'failed') {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 3000)
          controller.signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
        })
        task = await getSeedanceTask(task.id, controller.signal)
        setSeedanceTask(task)
        setSeedanceStatus(task.status)
      }
      if (task.status === 'failed') setSeedanceError(task.error || '视频生成没有完成，你仍可导出本地回响短片。')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setSeedanceStatus('failed')
      setSeedanceError(error instanceof Error ? error.message : 'Seedance 暂时不可用')
    }
  }

  function cancelSeedancePolling() {
    seedanceAbortRef.current?.abort()
    seedanceAbortRef.current = null
    setSeedanceStatus('idle')
  }

  async function exportReel() {
    setRenderingReel(true)
    setReelError('')
    try {
      const blob = await renderReelVideo({ title: world.worldTitle, shots: reelShots })
      downloadBlob(blob, `EchoForge-${world.themeId}-回响短片.webm`)
    } catch (error) {
      setReelError(error instanceof Error ? error.message : '当前浏览器无法导出视频')
    } finally {
      setRenderingReel(false)
    }
  }
  return (
    <main className="rv-reflection">
      <header><button onClick={onBack}>← 回到世界</button><div className="rv-brand"><Mark /><span>本局回响</span></div><button onClick={onRestart}>结束本局</button></header>
      <section className="rv-reflection__sheet">
        <div className="rv-reflection__intro"><small>先回应你真正带来的问题</small><h1>我们听见的，<br />不只是一个<em>选择题。</em></h1></div>
        <section className="rv-real-answer" aria-label="针对现实处境的分析与行动建议">
          <article className="rv-real-answer__heard"><small>01 · 先说一句人话</small><h2>{reflectionInsight.acknowledgement}</h2><p>{reflectionInsight.coreTension}</p>{insightLoading && <span role="status">正在结合本局选择补充更贴合的分析…</span>}</article>
          <article className="rv-real-answer__assessment"><small>02 · 我们现在怎么看这件事</small><p>{reflectionInsight.assessment}</p><div><section><strong>现在能确认</strong><ul>{reflectionInsight.knownFacts.map((item) => <li key={item}>{item}</li>)}</ul></section><section><strong>决定前还要补</strong><ul>{reflectionInsight.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></section></div></article>
          <section className="rv-real-answer__options"><header><small>03 · 不是一个标准答案，而是三条有代价的路</small><h2>哪条路更合适，取决于条件，不取决于谁声音更大。</h2></header><div>{reflectionInsight.options.map((option, index) => <article key={option.title}><span>方案 {index + 1}</span><h3>{option.title}</h3><p><b>可能得到：</b>{option.upside}</p><p><b>需要承担：</b>{option.cost}</p><small><b>更适合：</b>{option.bestWhen}</small></article>)}</div></section>
          <article className="rv-real-answer__next"><div><small>04 · 你现在就能做的一步</small><h2>{reflectionInsight.nextStep.title}</h2><ol>{reflectionInsight.nextStep.steps.map((step) => <li key={step}>{step}</li>)}</ol></div><aside><strong>可以直接这样说</strong><blockquote>“{reflectionInsight.nextStep.script}”</blockquote><p><b>完成信号：</b>{reflectionInsight.nextStep.successSignal}</p><p><b>暂停条件：</b>{reflectionInsight.nextStep.stopCondition}</p></aside></article>
        </section>
        <details className="rv-reflection__evidence"><summary>这份建议为什么和本局有关？查看选择与证据</summary>
        <section className="rv-understanding-path" aria-label="本局理解路径图">
          <header><div><small>不是故事树，而是可追溯的理解路径</small><h2>这局游戏，怎样改变了你看问题的方式？</h2></div><span>每个节点来自本局真实状态</span></header>
          <ol>{understandingPath.map((node, index) => <li key={node.kind} className={`rv-understanding-path__${node.kind}`}><i>{String(index + 1).padStart(2, '0')}</i><div><small>{node.label}</small><strong>{node.title}</strong><p>{node.detail}</p></div></li>)}</ol>
        </section>
        <div className="rv-reflection__grid">
          <article><span>01 · 我看见了什么</span><p>{insight}</p><small>依据：你在第 {Math.max(1, state.currentTurn)} 回合的行动，发现了 {found} 条线索。</small></article>
          <article><span>02 · 仍然不知道什么</span><p>{unknown}</p><small>未知不是漏洞，而是做决定前需要保留的边界。</small></article>
          <article className="rv-reflection__action"><span>03 · 游戏里形成的方法</span><p>{nextAction}</p><small>{repeated ? '你曾重复使用同一种行动；现实中可以主动更换信息来源或沟通对象。' : '这是低风险建议，不替你做决定，也不是心理诊断。'}</small></article>
        </div>
        <blockquote><small>你带来的现实片段</small>“{source}”</blockquote>
        </details>
        <section className={`rv-reel ${reelOpen ? 'is-open' : ''}`} aria-label="本局回响分镜">
          <button type="button" className="rv-reel__toggle" aria-expanded={reelOpen} onClick={() => setReelOpen((value) => !value)}><span>▶</span><strong>把本局变成一支回响短片</strong><small>不是重新编故事，而是把你真实走过的选择编成镜头</small></button>
          {reelOpen && <div className="rv-reel__body"><ol>{reelShots.map((shot, index) => <li key={`${shot.title}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{shot.title}</strong><p>{shot.subtitle}</p><small>{shot.meaning}</small></div></li>)}</ol><div className="rv-reel__actions"><p>本地 Canvas 合成 · 不上传你的原文 · 导出 WebM</p><button type="button" onClick={exportReel} disabled={renderingReel}>{renderingReel ? '正在逐帧合成…' : '导出 15 秒回响短片'}</button>{reelError && <span role="alert">{reelError}</span>}</div><section className="rv-seedance" aria-label="Seedance AI 回响短片"><div><small>SEEDANCE 2.0 · 可选增强</small><strong>把本局理解路径变成电影镜头</strong><p>仅发送去标识化的世界摘要，不发送你输入的现实原文。生成在后台进行，不影响你继续回看或离开。</p></div>{seedanceTask?.videoUrl && seedanceStatus === 'succeeded' ? <video src={seedanceTask.videoUrl} controls playsInline preload="metadata" aria-label="Seedance 生成的本局回响短片" /> : <div className="rv-seedance__controls">{(seedanceStatus === 'queued' || seedanceStatus === 'running') ? <><span role="status">{seedanceStatus === 'queued' ? '任务已排队，正在准备镜头…' : 'Seedance 正在生成镜头…'}</span><button type="button" onClick={cancelSeedancePolling}>停止等待</button></> : <button type="button" onClick={generateSeedanceReel}>{seedanceStatus === 'failed' ? '重新生成 AI 回响短片' : '生成 AI 回响短片'}</button>}{seedanceError && <span role="alert">{seedanceError}</span>}</div>}</section></div>}
        </section>
        <div className="rv-reflection__buttons"><button onClick={onBack}>换一种选择再看看</button><button className="rv-primary" onClick={onRestart}>带着回响离开 →</button></div>
      </section>
    </main>
  )
}

export function ClassicGame({ onExit }: { onExit: () => void }) {
  const [beat, setBeat] = useState(0)
  const [choices, setChoices] = useState<ClassicChoiceId[]>([])
  const [showEnding, setShowEnding] = useState(false)
  const selected = choices[beat]
  const current = classicBeats[beat]
  const chosen = current.choices.find((choice) => choice.id === selected)
  const choiceHistory = choices.flatMap((id, index) => {
    const choice = classicBeats[index]?.choices.find((item) => item.id === id)
    return choice ? [{ ...choice, beat: index + 1 }] : []
  })
  const finished = choices.length === classicBeats.length

  function choose(id: ClassicChoiceId) { setChoices((value) => [...value.slice(0, beat), id]) }
  function next() { if (beat < classicBeats.length - 1) setBeat((value) => value + 1) }
  return (
    <main className="rv-classic">
      <header><button onClick={onExit}>← 回响引擎</button><div className="rv-brand"><Mark /><span>名著入戏</span><small>原作 · 解读 · WHAT-IF</small></div><span>《三国演义》内容包</span></header>
      <section className="rv-classic__stage">
        <div className="rv-classic__mist"><i /><i /><i /><b>十万</b></div>
        <div className="rv-classic__copy"><small>第 {beat + 1} 幕 / {classicBeats.length} · {current.speaker} · {current.tension}</small><h1>草船借箭</h1><p>周瑜的矜贵、诸葛亮的推演、鲁肃的有限信任与曹操的多疑会持续影响每一幕。你将经历信息差怎样改变判断。</p><div className="rv-classic__progress">{classicBeats.map((_, index) => <i key={index} className={index <= beat ? 'is-done' : ''} />)}</div></div>
      </section>
      <section className="rv-classic__play">
        <div><small>原作约束下的互动局面 · 本幕视角：{current.speaker}</small><h2>{chosen ? '这个选择，改变了你看见的风险。' : current.prompt}</h2></div>
        {!chosen ? <div className="rv-classic__choices">{current.choices.map((choice) => <button key={choice.id} onClick={() => choose(choice.id)} aria-pressed="false"><strong>{choice.title}</strong><span>{choice.consequence}</span><b>→</b></button>)}</div> : <article className="rv-classic__result"><span role="status">✓ WHAT-IF · 你的选择：{chosen.title}</span><p>{chosen.consequence}</p><blockquote><b>{current.speaker}的人格在起作用：</b>{current.interpretation}</blockquote><div><small><b>原作事实</b>：{current.canon}</small><small><b>趣味解读</b>：{current.interpretation}</small><small><b>互动假设</b>：你的选择与心理活动不属于原作事实。</small></div>{beat < classicBeats.length - 1 ? <button onClick={next}>进入下一幕 →</button> : !showEnding ? <button onClick={() => setShowEnding(true)}>查看原作对照 →</button> : <section className="rv-classic__ending"><strong>本局原作对照</strong><p>原作线：军令 → 借船备草 → 等雾登船 → 曹营受箭 → 顺流撤回 → 按期交付。你的选择没有改写原作事实；下面是你实际走过的 What-if 路径。</p><ol aria-label={`本局${classicBeats.length}次选择`}>{choiceHistory.map((choice) => <li key={`${choice.beat}-${choice.id}`}><b>第 {choice.beat} 幕 · {choice.title}</b><span>{choice.consequence}</span></li>)}</ol><p>今日启发：面对“不可能任务”，先区分可控制的准备、可预测但不能保证的他人反应，以及不可控制的条件，并提前写清退出路径。</p><small>你本局完成了 {finished ? choices.length : 0} 次 What-if 决策；所有互动假设均未冒充原作事实。</small><button onClick={onExit}>完成体验，回到首页</button></section>}</article>}
      </section>
    </main>
  )
}

function useNarrator() {
  const ref = useRef<ResilientNarrator | null>(null)
  if (!ref.current) ref.current = new ResilientNarrator()
  return ref.current
}

export function Game({ source, world = compileWorld(source), initialState, onReflect, onExit, onStateChange }: { source: string; world?: CompiledWorld; initialState: WorldState; onReflect: (state: WorldState) => void; onExit: () => void; onStateChange?: (state: WorldState) => void }) {
  const [state, setState] = useState<WorldState>(() => initialState)
  const [freeText, setFreeText] = useState('')
  const [pendingNarrations, setPendingNarrations] = useState(0)
  const [portrait, setPortrait] = useState<string | undefined>()
  const [sceneFrames, setSceneFrames] = useState<Array<{ key: string; label: string; locationId: WorldState['playerLocationId']; stage: SceneStage; image?: string }>>([])
  const [selectedSceneKey, setSelectedSceneKey] = useState<string>()
  const [remoteAvailable, setRemoteAvailable] = useState<boolean | null>(null)
  const [imageAvailable, setImageAvailable] = useState(false)
  const [characterMode, setCharacterMode] = useState<'parallel-per-character' | 'deterministic-local' | 'unknown'>('unknown')
  const [agentsConsulted, setAgentsConsulted] = useState(0)
  const [agentRuntime, setAgentRuntime] = useState<'checking' | 'ready' | 'thinking' | 'model' | 'fallback' | 'offline'>('checking')
  const [subtitleQueue, setSubtitleQueue] = useState<Array<{ turn: number; text: string }>>([])
  const [lastChoiceLabel, setLastChoiceLabel] = useState('')
  const [choiceFlash, setChoiceFlash] = useState<{ id: string; label: string; turn: number } | null>(null)
  const [visibleActions, setVisibleActions] = useState<QuickAction[]>(() => getAvailableQuickActions(initialState, world).actions)
  const [turnImpact, setTurnImpact] = useState<string[]>([])
  const [showGuide, setShowGuide] = useState(initialState.currentTurn === 0)
  const [sceneCollapsed, setSceneCollapsed] = useState(() => window.localStorage.getItem('redverse:scene-collapsed') === 'true')
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false)
  const [characterVoice, setCharacterVoice] = useState(false)
  const narrator = useNarrator()
  const logEndRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef(initialState)
  const committingRef = useRef(false)
  const completedNarrationsRef = useRef(new Map<number, string>())
  const nextSubtitleTurnRef = useRef(initialState.currentTurn + 1)
  const speech = useSpeechInput(setFreeText)
  const soundscape = useSoundscape(state.weather, { locationId: state.playerLocationId, progress: state.currentTurn })
  const voice = useMimoVoice()
  const busy = pendingNarrations > 0

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then((d) => {
      const available = Boolean(d.hasKey || d.aiEnabled)
      setRemoteAvailable(available)
      setImageAvailable(Boolean(d.imageEnabled))
      setCharacterMode(d.characterMode === 'parallel-per-character' ? d.characterMode : 'deterministic-local')
      setAgentRuntime(available ? 'ready' : 'offline')
    }).catch(() => { setRemoteAvailable(false); setAgentRuntime('offline') })
  }, [])
  // 同一帧内拒绝双击复用旧按钮；新回合一经渲染，下一组选项立刻恢复可操作。
  useEffect(() => { committingRef.current = false }, [state.currentTurn])
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [state.log.length])
  useEffect(() => {
    const loc = locations.find((item) => item.id === state.playerLocationId)
    if (!loc) return
    let cancelled = false
    const copy = world.locationCopy[loc.id]
    const stage: SceneStage = state.flags.ending_reached ? 'ending' : state.clues.clue_combined_proof !== 'hidden' ? 'connected' : state.currentTurn >= 5 ? 'turning' : 'opening'
    const latestNarration = [...state.log].reverse().find((entry) => entry.kind === 'narration')?.text || '玩家刚进入这个世界，人物正在观察彼此。'
    // A scene is a turn-level story frame, not merely a location skin. Keeping
    // the turn in the key prevents a changed consequence from reusing the same
    // picture just because the player stayed in one room.
    const frameKey = `${world.themeId}_${loc.id}_${stage}-turn-${state.currentTurn}${stage === 'ending' ? `-${state.activeWorldline}` : ''}`
    const frameLabel = `${copy.shortName} · ${state.currentTurn === 0 ? '初见' : state.flags.ending_reached ? '结局' : `第 ${state.currentTurn} 回合`}`
    setSelectedSceneKey(frameKey)
    setSceneFrames((frames) => frames.some((frame) => frame.key === frameKey) ? frames : [...frames, { key: frameKey, label: frameLabel, locationId: loc.id, stage }].slice(-6))
    if (!imageAvailable) return
    generatePortrait(`东方水墨水彩叙事游戏关键镜头，16:9，角色与前序镜头画风一致。世界：${world.worldTitle}。地点：${copy.name}，${copy.description}。剧情阶段：${frameLabel}。本回合已经发生：${latestNarration.slice(0, 420)}。天气：${state.weather}。画面必须准确表现本回合新增的行动、人物反应或证据变化，人物外观与前序一致；不要文字，不要界面。`, frameKey).then((img) => {
      if (cancelled || !img) return
      setPortrait(img)
      setSceneFrames((frames) => frames.map((frame) => frame.key === frameKey ? { ...frame, image: img } : frame))
    })
    return () => { cancelled = true }
  }, [imageAvailable, state.activeWorldline, state.currentTurn, state.flags.ending_reached, state.clues.clue_combined_proof, state.log, state.playerLocationId, state.weather, world])
  useEffect(() => () => window.speechSynthesis?.cancel(), [])
  useEffect(() => { window.localStorage.setItem('redverse:scene-collapsed', String(sceneCollapsed)) }, [sceneCollapsed])

  const currentLocation = useMemo(() => locations.find((item) => item.id === state.playerLocationId)!, [state.playerLocationId])
  const selectedScene = sceneFrames.find((frame) => frame.key === selectedSceneKey)
  const currentSceneStage: SceneStage = state.flags.ending_reached ? 'ending' : state.clues.clue_combined_proof !== 'hidden' ? 'connected' : state.currentTurn >= 5 ? 'turning' : 'opening'
  const activeCharacterActions = state.lastCharacterActions
  const activeSubtitle = subtitleQueue[0]
  const subtitlePlaying = Boolean(activeSubtitle)

  function flushCompletedNarrations() {
    const ready: Array<{ turn: number; text: string }> = []
    while (completedNarrationsRef.current.has(nextSubtitleTurnRef.current)) {
      const turn = nextSubtitleTurnRef.current
      ready.push({ turn, text: completedNarrationsRef.current.get(turn)! })
      completedNarrationsRef.current.delete(turn)
      nextSubtitleTurnRef.current += 1
    }
    if (ready.length) setSubtitleQueue((queue) => [...queue, ...ready])
  }

  function dispatchAction(action: PlayerAction, actionId?: string) {
    if (committingRef.current || stateRef.current.flags.ending_reached) return
    committingRef.current = true

    const previousState = stateRef.current
    const chosenId = actionId || `${action.type}:${action.targetId || previousState.playerLocationId}`
    const chosenLabel = visibleActions.find((item) => item.id === chosenId)?.label || action.freeText || '自由行动'
    const { state: nextState, result } = resolveTurn(previousState, action, world)
    const turn = nextState.currentTurn
    stateRef.current = nextState

    // 世界结算与字幕表现彻底解耦：新目标、线索和选项在本次点击内立即提交。
    setState(nextState)
    onStateChange?.(nextState)
    setVisibleActions(getAvailableQuickActions(nextState, world).actions)
    setTurnImpact([`你做了：${chosenLabel}`, describeGoalDelta(previousState, nextState, world), ...describeTurnImpact(result, world)].slice(0, 5))
    setLastChoiceLabel(chosenLabel)
    setChoiceFlash({ id: chosenId, label: chosenLabel, turn })
    setPendingNarrations((count) => count + 1)
    soundscape.ping(result.discoveredClueIds.length ? 'clue' : 'choice')
    // 让玩家看得见刚刚提交的是哪一个选择；它只是回执，不会占用或锁住新选项。
    window.setTimeout(() => setChoiceFlash((current) => current?.turn === turn ? null : current), 1200)

    // 关键角色并行提出结构化动作；Director 已在服务端限额校验。它是异步增强，
    // 不阻塞本地世界结算或下一组选项，任何失败都保留确定性角色策略。
    if (remoteAvailable) {
      setAgentRuntime('thinking')
      void requestCharacterActions(nextState, action, world).then((response) => {
        if (stateRef.current.currentTurn !== turn) return
        const remoteActions = response.actions
        setAgentsConsulted(response.agentsConsulted)
        if (response.mode !== 'unknown') setCharacterMode(response.mode)
        if (!remoteActions.length) { setAgentRuntime('fallback'); return }
        setState((current) => {
          if (current.currentTurn !== turn) return current
          const patched = structuredClone(current)
          patched.lastCharacterActions = remoteActions
          for (const proposal of remoteActions) {
            const runtime = patched.npcStates[proposal.npcId]
            runtime.lastAction = proposal
            runtime.emotion = proposal.performance.emotion
            runtime.recentMemories = [...runtime.recentMemories, `第${turn}回合：${proposal.intent}`].slice(-5)
          }
          stateRef.current = patched
          return patched
        })
        setAgentRuntime('model')
      }).catch(() => { if (stateRef.current.currentTurn === turn) setAgentRuntime('fallback') })
    } else setAgentRuntime('offline')

    const narrationProvider = remoteAvailable ? narrator : createNarrator('local')
    void narrationProvider.narrate({ state: nextState, action, result, sourceContext: source }).then((narrationText) => {
      // 旁白只能回填自己的回合；较慢的旧请求不能覆盖更新的世界状态。
      setState((current) => {
        const patched = {
          ...current,
          log: current.log.map((entry) => entry.turn === turn && entry.kind === 'narration' ? { ...entry, text: narrationText } : entry),
        }
        stateRef.current = patched
        return patched
      })
      // 多个旁白请求可能乱序返回；按回合排队，既不打断当前字幕，也不漏掉中间回合。
      completedNarrationsRef.current.set(turn, narrationText)
      flushCompletedNarrations()
      if (characterVoice && voice.configured) void voice.speak(narrationText, 'narrator', result.discoveredClueIds.length ? '发现线索时先压低声音，再在关键信息上加重；有悬念，不要播音腔。' : '像电影旁白一样自然承接上一刻；语气克制，按标点停顿，最后的问题留出余韵。')
    }).finally(() => setPendingNarrations((count) => Math.max(0, count - 1)))
  }

  const act = (type: PlayerAction['type'], targetId?: string, actionId?: string) => dispatchAction({ clientActionId: `${type}_${Date.now()}`, type, targetId }, actionId)
  function handleFreeSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!freeText.trim()) return
    const action = interpretFreeText(freeText, stateRef.current)
    setFreeText('')
    dispatchAction(action, 'free-text')
  }

  const evidenceCount = Object.values(state.clues).filter((status) => status === 'discovered' || status === 'connected' || status === 'resolved').length
  const currentLocationCopy = world.locationCopy[currentLocation.id]
  const endingSteps = [
    { label: `核对${world.clueCopy.clue_draft_map.name}`, where: `去${world.locationCopy.chart_room.shortName}调查原始材料`, done: state.clues.clue_draft_map === 'discovered' || state.clues.clue_draft_map === 'connected' || state.clues.clue_draft_map === 'resolved' },
    { label: `找到独立的${world.clueCopy.clue_night_log.name}`, where: `去${world.locationCopy.crow_nest.shortName}核对另一来源`, done: state.clues.clue_night_log === 'discovered' || state.clues.clue_night_log === 'connected' || state.clues.clue_night_log === 'resolved' },
    { label: `主动组合${world.clueCopy.clue_combined_proof.name}`, where: '两份信息齐全后，点击金色的“组合”行动', done: state.clues.clue_combined_proof !== 'hidden' },
    { label: `向${world.lexicon.captainName}提交复核`, where: `最后去${world.locationCopy.captain_room.shortName}，交给能推动改变的人`, done: Boolean(state.flags.ending_reached) },
  ]
  const forgettingEnding = state.flags.ending_reached && state.activeWorldline === 'forgetting'
  const progressStage = Math.max(0, endingSteps.filter((step) => step.done).length - 1)
  const currentEndingStep = endingSteps.findIndex((step) => !step.done)
  const recommendedAction = visibleActions.find((action) => action.tone === 'important') ?? visibleActions[0]
  const objective = state.flags.ending_reached
    ? forgettingEnding
      ? { title: '结局已触发：沉默成为默认答案', detail: '你保留了当下的安全，却也把定义事实的主动权交给了时间和别人。现在可以回看：现实中怎样做一个更小、更可逆的行动。' }
      : { title: '结局已触发：事实进入复核', detail: '你没有靠更响亮的情绪赢下争论，而是让独立信息进入一个可复核的过程。现在可以查看它对现实困境的启发。' }
    : state.clues.clue_combined_proof !== 'hidden'
      ? { title: `把证据交给${world.lexicon.captainName}`, detail: `前往${world.locationCopy.captain_room.shortName}，选择“提交复核”。这是本局真相结局的最后一步。` }
      : endingSteps[0].done && endingSteps[1].done
        ? { title: '主动把两条线索连起来', detail: '两份信息已经齐了；选择金色的“组合证据”行动，检查它们能否彼此印证。' }
        : endingSteps[0].done || endingSteps[1].done
          ? { title: '寻找第二个独立来源', detail: '已有发现只能说明一部分。去另一个地点验证，避免把猜测当成动机。' }
          : { title: world.objectiveTitle, detail: world.objectiveDetail }

  const agentRuntimeCopy = agentRuntime === 'thinking'
    ? '角色 Agent 正在分别思考；当前结果先由世界规则结算'
    : agentRuntime === 'model'
      ? `本回合 ${agentsConsulted || 3} 位角色分别完成独立提案；Director 已采纳其中 ${activeCharacterActions.length} 个`
      : agentRuntime === 'fallback'
        ? '本回合模型未产生合法动作，已由确定性角色策略接管'
        : agentRuntime === 'offline'
          ? '角色人格、记忆与策略在本地运行；联网模型未启用'
          : agentRuntime === 'ready'
            ? `${characterMode === 'parallel-per-character' ? '3 位角色 Agent 已就绪' : '角色模型已就绪'}；行动后将按各自人格、目标和记忆独立提案`
            : '正在检查角色 Agent 运行状态'

  return (
    <div className="rv-app">
      <header className="rv-topbar">
        <button className="rv-topbar__brand" onClick={onExit}><Mark /><span>回响引擎 EchoForge</span></button>
        <div className="rv-topbar__title"><span>世界 01</span><strong>{world.worldTitle || WORLD_TITLE}</strong></div>
        <div className="rv-topbar__stats"><span>{state.currentTimeLabel}</span><span>{WEATHER_LABEL[state.weather]}</span><span className={`rv-worldline--${state.activeWorldline}`}>{WORLDLINE_LABEL[state.activeWorldline]}</span></div>
        <div className={`rv-topbar__badge ${remoteAvailable ? 'is-live' : ''}`} title={agentRuntimeCopy}>{agentRuntime === 'thinking' ? '● 3 位角色分别思考中' : remoteAvailable ? '● 独立角色 Agent 在线' : '● 本地角色策略'}</div>
      </header>

      <main className="rv-layout">
        <aside className="rv-col rv-col--map">
          <div className="rv-section-head"><h2>世界地图</h2><small>WORLD MAP</small></div>
          <div className="rv-map"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M20 40 50 78 60 12 78 30" /></svg>
            {locations.map((loc) => {
              const discovered = state.discoveredLocationIds.includes(loc.id)
              const isHere = loc.id === state.playerLocationId
              const copy = world.locationCopy[loc.id]
              return <button key={loc.id} className={`rv-map__node ${isHere ? 'is-here' : ''} ${discovered ? 'is-open' : 'is-locked'}`} style={{ left: `${loc.x}%`, top: `${loc.y}%` }} disabled={!discovered || isHere} onClick={() => act('move', loc.id)} title={discovered ? copy.name : loc.unlockHint}><span className="rv-map__dot" /><small>{discovered ? copy.shortName : '未知'}</small></button>
            })}
          </div>
          <div className="rv-objective"><small>{state.flags.ending_reached ? '本局实验 · 已完成' : `抵达结局 · ${endingSteps.filter((step) => step.done).length} / 4`}</small><strong>{objective.title}</strong><p>{objective.detail}</p>{forgettingEnding ? <div className="rv-ending-fork"><b>你抵达了“默认翻篇”结局</b><span>另一条路径：核对两个独立来源 → 组合信息 → 提交复核</span></div> : <><div className="rv-objective__meter" aria-label={`结局进度 ${endingSteps.filter((step) => step.done).length}/4`}>{endingSteps.map((step) => <i key={step.label} className={step.done ? 'is-done' : ''} />)}</div><ol className="rv-ending-route" aria-label="结局触发条件">{endingSteps.map((step, index) => <li key={step.label} className={`${step.done ? 'is-done' : ''} ${index === currentEndingStep ? 'is-current' : ''}`}><span>{step.done ? '✓' : index + 1}</span><div><b>{step.label}</b><small>{step.where}</small></div></li>)}</ol>{recommendedAction && <div className="rv-objective__next"><small>现在直接点</small><b>{recommendedAction.label}</b><span>{recommendedAction.hint}</span></div>}</>}<details><summary>为什么要这样才能到结局？</summary><p>目标不是收集积分，而是练习一条现实可迁移的方法：先找两个独立来源，再检查它们能否互证，最后把信息交给能推动改变的人。第 12 回合后世界会提醒时间正在流逝，但由你选择继续追查，或主动接受翻篇。</p></details></div>
          <div className="rv-source"><small>来自你的现实 · {world.conflictFocus}</small><p>{source}</p><em>{world.openingQuestion}</em></div>
        </aside>

        <section className="rv-col rv-col--scene">
          {showGuide && <div className="rv-guide" role="dialog" aria-label="本局玩法说明"><button onClick={() => setShowGuide(false)} aria-label="关闭玩法说明">×</button><small>这一局不是猜正确答案</small><h2>用选择，把“我觉得”变成“我知道”。</h2><ol><li><b>1</b><span><strong>行动</strong>观察、调查或交谈</span></li><li><b>2</b><span><strong>看后果</strong>角色会按自己的原则回应</span></li><li><b>3</b><span><strong>连线索</strong>独立信息互相印证才可行动</span></li><li><b>4</b><span><strong>带走回响</strong>把游戏中的方法带回现实</span></li></ol><button className="rv-primary" onClick={() => setShowGuide(false)}>明白，开始探索 →</button></div>}
          <div className={`rv-scene-card rv-scene-card--turn-${state.currentTurn % 3} ${sceneCollapsed ? 'is-collapsed' : ''}`}><div className="rv-scene-visual" aria-hidden={sceneCollapsed}><HarborScene weather={state.weather} portrait={selectedScene ? selectedScene.image : portrait} label={world.worldTitle} locationId={selectedScene?.locationId ?? state.playerLocationId} stage={selectedScene?.stage ?? currentSceneStage} /></div><div className="rv-scene-card__caption"><span>当前位置</span><h1>{currentLocationCopy.name}</h1><p>{currentLocationCopy.description}</p></div>
            <div className="rv-scene-controls" aria-label="演出控制"><span className="rv-scene-count">场景 {locations.findIndex((item) => item.id === state.playerLocationId) + 1} / {locations.length}</span><button type="button" className={soundscape.enabled ? 'is-on' : ''} onClick={soundscape.toggle} aria-pressed={soundscape.enabled} disabled={!soundscape.supported} title={`浏览器实时合成 · ${soundscape.label}`}>实时声景 {soundscape.enabled ? soundscape.label : '关'}</button><button type="button" className={characterVoice ? 'is-on' : ''} onClick={() => voice.configured ? setCharacterVoice((value) => !value) : setVoiceSettingsOpen(true)} aria-pressed={characterVoice}>{voice.configured ? `情绪配音 ${characterVoice ? '开' : '关'}` : '配置情绪配音'}</button><button type="button" className="rv-scene-collapse" onClick={() => setSceneCollapsed((value) => !value)} aria-expanded={!sceneCollapsed} aria-label={sceneCollapsed ? '展开场景图片' : '收起场景图片'}>{sceneCollapsed ? '▣ 展开画面' : '▱ 收起画面'}</button></div>
            {!!activeCharacterActions.length && <div className="rv-agent-actions" aria-label="角色自主行动">
              {activeCharacterActions.map((characterAction) => <div key={`${state.currentTurn}-${characterAction.npcId}-${characterAction.kind}`} className={`rv-agent-action rv-agent-action--${characterAction.performance.emphasis}`}>
                <span>{npcs[characterAction.npcId].portraitSymbol}</span><div><small>{world.lexicon[`${characterAction.npcId}Name` as 'partnerName' | 'witnessName' | 'captainName']}自主行动 · {characterAction.kind.toUpperCase()}</small><strong>{displayCharacterAction(world, characterAction)}</strong><em>{characterAction.intent}</em></div>
              </div>)}
            </div>}
            {activeSubtitle && <TypewriterSubtitle key={activeSubtitle.turn} className="rv-scene-subtitle" text={activeSubtitle.text} onComplete={() => setSubtitleQueue((queue) => queue.slice(1))} />}
          </div>
          {!sceneCollapsed && sceneFrames.length > 0 && <nav className="rv-scene-filmstrip" aria-label="本局关键剧情镜头"><b>本局镜头</b>{sceneFrames.map((frame) => <button key={frame.key} type="button" className={frame.key === selectedSceneKey ? 'is-selected' : ''} onClick={() => setSelectedSceneKey(frame.key)} aria-pressed={frame.key === selectedSceneKey}><span className={`rv-scene-thumb rv-scene-thumb--${frame.locationId} rv-scene-thumb--${frame.stage}`}>{frame.image ? <img src={frame.image} alt="" /> : <i />}</span><small>{frame.label}</small></button>)}</nav>}
          {!!turnImpact.length && <div className="rv-impact" role="status" aria-label={`第 ${state.currentTurn} 回合行动结果`}><small>第 {state.currentTurn} 回合已结算</small><div>{turnImpact.map((item, index) => <span key={item} className={index === 0 ? 'is-choice' : ''}>{item}</span>)}</div><b>↓ 新选项已经根据这些结果更新</b></div>}
          <details className={`rv-agent-runtime rv-agent-runtime--${agentRuntime}`} aria-label="角色 Agent 运行回执"><summary><span>{agentRuntime === 'thinking' ? '◌' : agentRuntime === 'model' ? '✓' : '◇'}</span><strong>{agentRuntimeCopy}</strong><small>查看这一步由谁生成</small></summary><div><p><b>立即出现</b>世界规则结算线索、关系、时间与新选项，所以无需等待模型。</p><p><b>随后更新</b>{remoteAvailable ? '三位角色分别读取自己的原则、目标、情绪和记忆并行提案；Director 只采纳合法动作。' : '联网角色模型未启用；同一套人格约束由本地确定性策略执行。'}</p><p><b>叙事表达</b>{busy ? '旁白正在异步润色，不能改写已经发生的事实。' : '旁白只表现已结算事实，不决定世界结果。'}</p></div></details>
          <div className="rv-log">
            <div className="rv-chapter"><small>第 {Math.min(state.currentTurn + 1, 4)} 幕</small><strong>{world.chapterTitles[Math.min(progressStage, 3)]}</strong></div>
            {state.log.filter((entry) => entry.kind !== 'event').slice(-2).map((entry, index) => <div key={`${entry.turn}-${index}`} className={`rv-log__entry rv-log__entry--${entry.kind}`}><span className="rv-log__time">{entry.timeLabel}</span><p>{entry.turn === 0 && entry.kind === 'system' ? world.openingNarrative : entry.text}</p></div>)}
            {busy && <div className="rv-log__entry rv-log__entry--loading"><i /> 叙事者正在润色刚才发生的事；世界已经可以继续行动…</div>}
            <div ref={logEndRef} />
          </div>
          <div className="rv-actions">
            {state.flags.ending_reached ? <section className="rv-ending-gate" aria-label="本局结局已触发"><div><small>ENDING REACHED · {forgettingEnding ? '默认翻篇线' : '事实复核线'}</small><strong>{forgettingEnding ? '等待也被世界结算成了一种选择。' : '你让事实进入了可复核的流程。'}</strong><p>{forgettingEnding ? '现在去看：沉默保护了什么，又把什么交给了时间。' : '现在去看：这条游戏路径怎样变成现实中可逆的一小步。'}</p></div><button type="button" onClick={() => onReflect(state)}>查看结局与现实启发 →</button></section> : <>
              <div className="rv-actions__head"><div><strong>接下来，你想怎么做？</strong><small>{subtitlePlaying ? '字幕正在讲述上一回合，但你现在就可以继续选择。' : busy ? '新选项已生效；叙事者仍在润色上一回合。' : '没有标准答案；不同选择会改变线索、关系和下一组选项。'}</small></div>{lastChoiceLabel && <span className="rv-last-choice">✓ 刚才选择：{lastChoiceLabel}</span>}</div>
              <div className="rv-actions__quick" key={state.currentTurn} data-action-turn={state.currentTurn} aria-live="polite" aria-label={`第 ${state.currentTurn + 1} 回合可选行动`}>
                {visibleActions.map((item) => <button key={`${item.id}-${item.label}`} className={item.tone === 'important' ? 'is-important' : ''} onClick={() => act(item.type, item.targetId, item.id)} title={item.hint} aria-pressed="false"><i>{item.icon}</i><strong>{item.label}</strong><small>{item.hint}</small></button>)}
              </div>
              {choiceFlash && <div className="rv-choice-flash" role="status" aria-label={`已选择 ${choiceFlash.label}`}><span>✓</span><strong>{choiceFlash.label}</strong><small>选择已生效，新选项已更新</small></div>}
              <form className="rv-actions__free" onSubmit={handleFreeSubmit}><input type="text" aria-label="输入自由行动" placeholder={`也可以自由输入，例如：我先去${world.locationCopy.chart_room.shortName}核对${world.lexicon.artifact}…`} value={freeText} onChange={(event) => setFreeText(event.target.value)} /><button type="button" className={speech.listening ? 'is-listening' : ''} onClick={speech.toggle} aria-label={speech.listening ? '停止语音行动' : '说出自由行动'} title={speech.supported ? '说出自由行动' : '当前浏览器不支持语音输入'}>🎙</button><button type="submit" aria-label="提交自由行动" disabled={!freeText.trim()}>→</button></form>
            </>}
          </div>
        </section>

        <aside className="rv-col rv-col--info">
          <div className="rv-section-head"><h2>人物与他们的立场</h2><small>他们不会为讨好你改掉原则</small></div>
          <div className="rv-npc-list">
            {Object.values(npcs).map((npc) => {
              const npcState = state.npcStates[npc.id]
              const brief = getWorldAgentBrief(world, npc.id)
              return <article key={npc.id} className={`rv-npc-card ${npcState.lastAction ? 'has-acted' : ''}`}><div className="rv-npc-card__portrait">{npc.portraitSymbol}</div><div className="rv-npc-card__body"><div className="rv-npc-card__head"><strong>{brief.name}</strong><small>{world.roleLabels[npc.id]}</small></div><p>“{brief.principle}”</p><div className="rv-agent-trace"><span><b>不变原则</b>{brief.principle}</span><span><b>当前目标</b>{brief.goal}</span><span><b>此刻状态</b>{npcState.emotion}{npcState.lastAction ? ` · ${npcState.lastAction.intent}` : ' · 正在观察'}</span></div><div className="rv-trust"><span>信任 {npcState.trust}</span><i><b style={{ '--trust-ratio': npcState.trust / 100 } as React.CSSProperties} /></i></div></div></article>
            })}
          </div>
          <div className="rv-section-head rv-section-head--clues"><h2>你目前能确认什么</h2><small>线索只证明它能证明的部分</small></div>
          <div className="rv-clue-groups">
            {CLUE_GROUPS.map((group) => {
              const items = Object.values(clues).filter((clue) => group.match(state.clues[clue.id]))
              if (!items.length) return null
              return <div key={group.key} className="rv-clue-group"><h3>{group.label}</h3>{items.map((clue) => <article key={clue.id} className="rv-clue-card"><strong>{world.clueCopy[clue.id].name}</strong><small>{world.locationCopy[clue.originLocationId].shortName} · {state.clues[clue.id]}</small><p>{world.clueCopy[clue.id].meaning}</p><em>{state.clues[clue.id] === 'hinted' ? '下一步：继续调查，把异常变成可核对的信息' : clue.id === 'clue_combined_proof' ? `现在可以用它推进${world.lexicon.process}` : '作用：与另一份独立信息互证，不能用它直接猜动机'}</em></article>)}</div>
            })}
            {Object.values(state.clues).every((status) => status === 'hidden') && <p className="rv-clue-empty">还没有可确认的信息。先观察现场或和一个人谈谈；不要急着把猜测当成事实。</p>}
          </div>
          <details className="rv-debug"><summary>查看结构化世界状态</summary><ul><li>回合 {state.currentTurn}</li><li>因果事件 {state.triggeredEventIds.length} / {eventTemplates.length}</li><li>证据链 {state.flags.proof_presented ? '已建立' : '未建立'}</li></ul></details>
        </aside>
      </main>

      {voiceSettingsOpen && <MimoVoiceSettings configured={voice.configured} serverConfigured={voice.serverConfigured} hasSessionKey={voice.hasSessionKey} error={voice.error} onSave={(key) => { voice.saveSessionKey(key); setCharacterVoice(true) }} onClear={() => { voice.clearSessionKey(); setCharacterVoice(false) }} onClose={() => setVoiceSettingsOpen(false)} />}

      <footer className="rv-footer"><span>{state.flags.ending_reached ? forgettingEnding ? '默认翻篇结局：等待保护了当下，也让别人定义了结果' : '复核结局：你的选择已经形成一条可解释的现实方法' : `结局进度 ${endingSteps.filter((step) => step.done).length}/4 · 当前已找到 ${evidenceCount} 条可用信息`}</span><button type="button" className="rv-help" onClick={() => setShowGuide(true)}>怎么玩？</button>{!state.flags.ending_reached && <button onClick={() => onReflect(state)} disabled={state.currentTurn < MIN_REFLECTION_TURNS}>{state.currentTurn < MIN_REFLECTION_TURNS ? `再行动 ${MIN_REFLECTION_TURNS - state.currentTurn} 次即可回看` : '把本局方法带回现实（可提前回看）'} <b>↗</b></button>}</footer>
    </div>
  )
}

export default function RedverseApp() {
  const restoredRef = useRef(loadMirrorSession())
  const [screen, setScreen] = useState<Screen>(() => restoredRef.current?.screen ?? 'landing')
  const [source, setSource] = useState(() => restoredRef.current?.source ?? DEFAULT_STORY)
  const [route, setRoute] = useState<RouteId>('mirror')
  const [desiredOutcome, setDesiredOutcome] = useState<(typeof OUTCOMES)[number]>('找到下一步')
  const [gameKey, setGameKey] = useState(0)
  const [reflectionState, setReflectionState] = useState<WorldState>(() => restoredRef.current?.state ?? createInitialWorldState())
  const [world, setWorld] = useState<CompiledWorld>(() => restoredRef.current?.world ?? compileWorld(restoredRef.current?.source ?? DEFAULT_STORY))

  function start(nextRoute: RouteId, story: string, desiredOutcome: (typeof OUTCOMES)[number]) {
    clearMirrorSession()
    setRoute(nextRoute)
    setDesiredOutcome(desiredOutcome)
    setSource(story)
    setWorld(compileWorld(story))
    setReflectionState(createInitialWorldState())
    setScreen(nextRoute === 'classic' ? 'library' : 'generating')
  }
  function restart() { clearMirrorSession(); setGameKey((value) => value + 1); setScreen('landing') }

  if (screen === 'landing') return <Landing initialStory={source === DEFAULT_STORY ? '' : source} onStart={start} />
  if (screen === 'library') return <ContentLibrary onExit={restart} onChoose={(pack) => setScreen(pack)} />
  if (screen === 'generating') return <Generating source={source} route={route} world={world} onCancel={() => setScreen('landing')} onReady={(generatedWorld) => { setWorld(generatedWorld); setScreen(route === 'classic' ? 'classic' : 'receipt') }} />
  if (screen === 'receipt') return <WorldReceipt source={source} desiredOutcome={desiredOutcome} world={world} onRevise={() => setScreen('landing')} onConfirm={() => setScreen('game')} />
  if (screen === 'caocao') return <GenerativePgcGame spec={caocaoPgcSpec} onExit={() => setScreen('library')} />
  if (screen === 'classic') return <GenerativePgcGame spec={classicPgcSpec} onExit={() => setScreen('library')} />
  if (screen === 'fusu') return <GenerativePgcGame spec={fusuPgcSpec} onExit={() => setScreen('library')} />
  if (screen === 'detective') return <DetectiveGame onExit={() => setScreen('library')} />
  if (screen === 'physical') return <PhysicalTheater onExit={() => setScreen('library')} />
  if (screen === 'reflection') return <Reflection state={reflectionState} source={source} world={world} onBack={() => { saveMirrorSession({ source, screen: 'game', state: reflectionState, world }); setScreen('game') }} onRestart={restart} />
  return <Game key={`${route}-${gameKey}`} source={source} world={world} initialState={reflectionState} onStateChange={(state) => { setReflectionState(state); saveMirrorSession({ source, screen: 'game', state, world }) }} onReflect={(state) => { setReflectionState(state); saveMirrorSession({ source, screen: 'reflection', state, world }); setScreen('reflection') }} onExit={restart} />
}
