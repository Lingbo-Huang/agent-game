import { useEffect, useReducer, useState } from 'react'
import { Character } from './components/Character'
import { ForestStage } from './components/ForestStage'
import { StoryShell } from './components/StoryShell'
import { companions, compileChildStory, emotionName, emotions, goals } from './content/story'
import { initialStoryState, storyReducer } from './engine/storyMachine'
import type { StoryAction, StoryState } from './types'
import { decideSafetyRoute, type SafetyDecision } from './redverse/safety'
import { useMimoVoice } from './redverse/useMimoVoice'

const Arrow = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4" /></svg>
)

function PrimaryButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button className="button button--primary" onClick={onClick} disabled={disabled}>{children}<Arrow /></button>
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button className="button button--ghost" onClick={onClick}>{children}</button>
}

function SetupPage({ state, dispatch }: { state: StoryState; dispatch: React.Dispatch<StoryAction> }) {
  const [safety, setSafety] = useState<SafetyDecision>({ route: 'story' })

  function startStory() {
    const decision = decideSafetyRoute(state.parentStory, 'children')
    setSafety(decision)
    if (decision.route === 'story') dispatch({ type: 'START' })
  }

  return (
    <main className="setup-page">
      <header className="setup-header">
        <div className="brand"><span className="brand__mark">✦</span><span>回响引擎 EchoForge · 小小冒险</span></div>
        <div className="setup-header__aside"><span>亲子共玩 · 约 6 分钟</span><div className="privacy-note"><span /> 这次故事不会保存</div></div>
      </header>

      <section className="setup-layout">
        <div className="setup-copy">
          <h1>把今天的小难题，<br /><em>变成一次小冒险。</em></h1>
          <p>不用急着讲道理。和孩子一起进入一个故事，试试看不同角色会怎么做。</p>
          <div className="setup-promise">
            <div><b>1</b><span><strong>你提供一点背景</strong><small>不用写真实姓名</small></span></div>
            <div><b>2</b><span><strong>孩子来做选择</strong><small>没有标准答案</small></span></div>
            <div><b>3</b><span><strong>带走一个小行动</strong><small>明天就能试试看</small></span></div>
          </div>
        </div>

        <form className="setup-form" onSubmit={(event) => { event.preventDefault(); startStory() }}>
          <div className="setup-form__number">01</div>
          <label htmlFor="parent-story">今天发生了什么？</label>
          <p>简单写一两句话就够了，系统会把现实人物变成寓言角色。</p>
          <textarea
            id="parent-story"
            rows={5}
            value={state.parentStory}
            onChange={(event) => dispatch({ type: 'UPDATE_SETUP', parentStory: event.target.value })}
          />
          <p className="setup-form__privacy">请只写情境，不写孩子或同伴的真实姓名、学校、住址、电话。</p>
          <div className="setup-form__divider" />
          <div className="setup-form__number">02</div>
          <fieldset>
            <legend>孩子大约几岁？</legend>
            <div className="goal-options" aria-label="选择年龄段">
              {(['4-6', '7-9', '10-12'] as const).map((ageBand) => (
                <label className={state.ageBand === ageBand ? 'selected' : ''} key={ageBand}>
                  <input type="radio" name="age-band" checked={state.ageBand === ageBand} onChange={() => dispatch({ type: 'UPDATE_SETUP', ageBand })} />
                  <span>{ageBand} 岁</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="setup-form__divider" />
          <div className="setup-form__number">03</div>
          <fieldset>
            <legend>这次想和孩子练习什么？</legend>
            <div className="goal-options">
              {goals.map((goal) => (
                <label className={state.learningGoal === goal ? 'selected' : ''} key={goal}>
                  <input type="radio" name="goal" checked={state.learningGoal === goal} onChange={() => dispatch({ type: 'UPDATE_SETUP', learningGoal: goal })} />
                  <span>{goal}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="parent-confirm">
            <input type="checkbox" checked={state.parentConfirmed} onChange={(event) => dispatch({ type: 'UPDATE_SETUP', parentConfirmed: event.target.checked })} />
            <span><strong>我是陪同孩子体验的家长、老师或可信任的大人</strong><small>这是一段共同阅读的故事，不是 AI 朋友，也不替代现实中的照顾与帮助。</small></span>
          </label>
          {safety.route !== 'story' && <section className={`child-safety child-safety--${safety.route}`} role="alert"><strong>{safety.title}</strong><p>{safety.message}</p><button type="button" onClick={() => setSafety({ route: 'story' })}>返回修改内容</button></section>}
          <button className="button button--primary button--wide" type="submit" disabled={!state.parentConfirmed || !state.parentStory.trim()}>生成今天的小冒险 <Arrow /></button>
          <small className="setup-form__footnote">演示版使用经过策划的低风险同伴情境，内容不会保存；遇到危险、欺凌或让孩子不舒服的事，请先找能到场的可信任大人。</small>
        </form>
      </section>
    </main>
  )
}

function CoverPage({ state, dispatch }: { state: StoryState; dispatch: React.Dispatch<StoryAction> }) {
  const story = compileChildStory(state.parentStory, state.ageBand, state.learningGoal)
  const voice = useMimoVoice()
  return (
    <main className="cover-page">
      <header className="cover-header"><div className="brand"><span className="brand__mark">✦</span><span>小小冒险</span></div><div className="privacy-note"><span /> 这次故事不会保存</div></header>
      <section className="cover-book">
        <div className="cover-book__art"><ForestStage step="cover" sceneLabel={`${story.title}的绘本画面`} /></div>
        <div className="cover-book__copy">
          <p>今天的故事</p>
          <h1>{story.title}</h1>
          <div className="cover-book__line" />
          <p className="cover-book__intro">{story.intro}</p>
          <button type="button" className="story-voice story-voice--cover" disabled={!voice.configured || voice.preparing || voice.playing} onClick={() => void voice.speak(`${story.title}。${story.intro}`, 'child_narrator', '像亲子绘本开场。声音温暖、清亮、有一点神秘；标题后停一下，遇到小狐狸的犹豫时放慢，绝不使用播音腔。')}>{voice.preparing ? '正在请旁白准备…' : voice.playing ? '旁白正在讲…' : '▶ 听旁白讲开场'}</button>
          <PrimaryButton onClick={() => dispatch({ type: 'OPEN_BOOK' })}>翻开故事</PrimaryButton>
          {voice.error && <small role="alert">配音暂时没有成功：{voice.error}</small>}
          <small>请把屏幕交给孩子，或者一起做选择</small>
        </div>
      </section>
    </main>
  )
}

function EmotionPage({ state, dispatch }: { state: StoryState; dispatch: React.Dispatch<StoryAction> }) {
  const story = compileChildStory(state.parentStory, state.ageBand, state.learningGoal)
  return (
    <StoryShell step="emotion" storyTitle={story.title} title="小狐狸的心里，像什么天气？" prompt="没有一定要选对的答案。挑一个最接近的，也可以说“都不是”。" onExit={() => dispatch({ type: 'RESTART' })}
      action={<PrimaryButton onClick={() => dispatch({ type: 'CONTINUE' })} disabled={!state.emotion}>带着这种感觉往前走</PrimaryButton>}>
      <div className="split-stage">
        <ForestStage step="emotion" sceneLabel={`${story.title}的绘本画面`} />
        <div className="emotion-grid" role="radiogroup" aria-label="选择小狐狸的感受">
          {emotions.map((emotion) => (
          <button type="button" role="radio" aria-checked={state.emotion === emotion.id} className={`emotion-option ${state.emotion === emotion.id ? 'selected' : ''}`} key={emotion.id} onClick={() => dispatch({ type: 'CHOOSE_EMOTION', emotion: emotion.id })}>
              <span className={`emotion-option__symbol emotion-option__symbol--${emotion.id}`}>{emotion.symbol}</span>
              <span><strong>{emotion.name}</strong><small>{emotion.hint}</small></span>
              <i>{state.emotion === emotion.id ? '✓' : ''}</i>
            </button>
          ))}
        </div>
      </div>
    </StoryShell>
  )
}

function CompanionsPage({ state, dispatch }: { state: StoryState; dispatch: React.Dispatch<StoryAction> }) {
  const story = compileChildStory(state.parentStory, state.ageBand, state.learningGoal)
  const voice = useMimoVoice()
  return (
    <StoryShell step="companions" storyTitle={story.title} title="三位伙伴，有三个不一样的主意。" prompt="你想先听谁的？每个办法都有它在保护的东西，也有可能错过的东西。" onExit={() => dispatch({ type: 'RESTART' })}
      action={<PrimaryButton onClick={() => dispatch({ type: 'CONTINUE' })} disabled={!state.companion}>带着这个主意继续</PrimaryButton>}>
      <div className="companion-stage"><ForestStage step="companions" sceneLabel={`${story.title}的绘本画面`} /></div>
      <div className="companion-options" role="radiogroup" aria-label="选择一位伙伴">
        {companions.map((companion) => (
          <button type="button" role="radio" aria-checked={state.companion === companion.id} className={`companion-option companion-option--${companion.id} ${state.companion === companion.id ? 'selected' : ''}`} key={companion.id} onClick={() => { dispatch({ type: 'CHOOSE_COMPANION', companion: companion.id }); void voice.speak(companion.advice, companion.id, companion.id === 'chongchong' ? '想到办法就忍不住说出口，明亮、语速稍快、句尾向上，但不要尖叫。' : companion.id === 'manman' ? '慢一点，像每句话都认真想过；温和可靠，停顿清楚，不要显得迟钝。' : '轻柔而好奇，先体会别人，再温柔提醒不要忘了自己；问句自然上扬。') }}>
            <Character kind={companion.id} size="small" label={companion.name} />
            <span className="companion-option__copy"><small>{companion.short}</small><strong>{companion.name}</strong><span>“{companion.advice}”</span><em>{companion.principle}</em></span>
            <i>{state.companion === companion.id ? '✓' : ''}</i>
          </button>
        ))}
      </div>
    </StoryShell>
  )
}

function PerspectivePage({ state, dispatch }: { state: StoryState; dispatch: React.Dispatch<StoryAction> }) {
  const story = compileChildStory(state.parentStory, state.ageBand, state.learningGoal)
  return (
    <StoryShell step="perspective" storyTitle={story.title} title={state.hasSeenPerspective ? '从这个位置看，故事有点不一样。' : story.perspectiveTitle} prompt={state.hasSeenPerspective ? story.perspectiveIntro : '看见别人的视角，不代表他一定做得对。只是先补上一块原来缺失的拼图。'} onExit={() => dispatch({ type: 'RESTART' })}
      action={state.hasSeenPerspective ? <PrimaryButton onClick={() => dispatch({ type: 'CONTINUE' })}>带着新线索回来</PrimaryButton> : <PrimaryButton onClick={() => dispatch({ type: 'SEE_PERSPECTIVE' })}>坐到小熊的位置</PrimaryButton>}>
      <div className="perspective-stage"><ForestStage step="perspective" sceneLabel={`${story.title}的绘本画面`} perspectiveRevealed={state.hasSeenPerspective} /></div>
      <div className={`perspective-clue ${state.hasSeenPerspective ? 'revealed' : ''}`}>
        <span>原来，小熊知道的是</span>
        <strong>{state.hasSeenPerspective ? story.known : '？'}</strong>
        <span>小熊不知道的是</span>
        <strong>{state.hasSeenPerspective ? story.unknown : '？'}</strong>
      </div>
    </StoryShell>
  )
}

function SentencePage({ state, dispatch }: { state: StoryState; dispatch: React.Dispatch<StoryAction> }) {
  const story = compileChildStory(state.parentStory, state.ageBand, state.learningGoal)
  const voice = useMimoVoice()
  return (
    <StoryShell step="sentence" storyTitle={story.title} title="现在，小狐狸想说一句话。" prompt={`它带着${emotionName(state.emotion)}，也知道小熊可能没有看见全部。选一句想试试的话。`} onExit={() => dispatch({ type: 'RESTART' })}
      action={<PrimaryButton onClick={() => dispatch({ type: 'CONTINUE' })} disabled={!state.sentence}>说出这句话</PrimaryButton>}>
      <div className="sentence-stage"><ForestStage step="sentence" sceneLabel={`${story.title}的绘本画面`} /></div>
      <div className="sentence-builder" role="radiogroup" aria-label="选择小狐狸要说的话">
        <span className="sentence-builder__lead">小狐狸深吸一口气，</span>
        {story.sentences.map((sentence) => (
          <button type="button" role="radio" aria-checked={state.sentence === sentence.id} className={`sentence-block ${state.sentence === sentence.id ? 'selected' : ''}`} key={sentence.id} onClick={() => { dispatch({ type: 'CHOOSE_SENTENCE', sentence: sentence.id }); void voice.speak(sentence.text, 'fox', sentence.id === 'boundary' ? '小狐狸在认真保护自己的边界。仍然是孩子的声音，清楚、稳定，不凶，也不胆怯。' : sentence.id === 'leave' ? '小狐狸有点难过，但正在照顾自己。声音柔和、平静，最后一句带一点重新站稳的力量。' : '小狐狸刚鼓起勇气说出愿望。开头有一点迟疑，后面真诚、清楚，保留孩子自然的呼吸和停顿。') }}>
            <small>{sentence.tone}</small><strong>{sentence.text}</strong><span>{sentence.title}</span>
          </button>
        ))}
      </div>
    </StoryShell>
  )
}

function OutcomePage({ state, dispatch }: { state: StoryState; dispatch: React.Dispatch<StoryAction> }) {
  const story = compileChildStory(state.parentStory, state.ageBand, state.learningGoal)
  const outcome = story.outcomes[state.sentence ?? 'join']
  return (
    <StoryShell step="outcome" storyTitle={story.title} title={outcome.title} prompt={outcome.body} voiceScript={[
      { text: `${outcome.title}。${outcome.body}`, speaker: 'child_narrator', delivery: '像故事抵达一个温暖转折，先讲清发生了什么，不急着总结；自然、有画面感。' },
      { text: outcome.bear, speaker: 'bear', delivery: '这是小熊刚明白对方感受后的回应。憨厚、真诚，带一点歉意，不夸张，不像成年人说教。' },
      { text: outcome.learning, speaker: 'child_narrator', delivery: '像陪孩子一起发现了一个小秘密，温暖但不下结论，结尾留一点余韵。' },
    ]} onExit={() => dispatch({ type: 'RESTART' })}
      action={<div className="dual-actions"><GhostButton onClick={() => dispatch({ type: 'REWIND' })}>↶ 倒带，再试一句</GhostButton><PrimaryButton onClick={() => dispatch({ type: 'CONTINUE' })}>收下今天的勇气卡</PrimaryButton></div>}>
      <div className="outcome-stage"><ForestStage step="outcome" sceneLabel={`${story.title}的绘本画面`} perspectiveRevealed outcomeHappy={state.sentence !== 'leave'} /></div>
      <blockquote className="bear-response"><Character kind="bear" size="small" /><p>{outcome.bear}</p></blockquote>
      <div className="learning-note"><span>今天发现</span><p>{outcome.learning}</p></div>
    </StoryShell>
  )
}

function CardPage({ state, dispatch }: { state: StoryState; dispatch: React.Dispatch<StoryAction> }) {
  const story = compileChildStory(state.parentStory, state.ageBand, state.learningGoal)
  const selectedSentence = story.sentences.find((sentence) => sentence.id === state.sentence) ?? story.sentences[0]
  return (
    <StoryShell step="card" storyTitle={story.title} title="这份勇气，可以带回明天。" prompt="不用一次做到完美。记住一句你愿意试试的话，就已经是很小、很真的一步。" onExit={() => dispatch({ type: 'RESTART' })}>
      <div className="finish-layout">
        <article className="courage-card">
          <div className="courage-card__sun">✦</div>
          <p>小狐狸的勇气卡</p>
          <h2>{story.cardTitle}</h2>
          <blockquote>{selectedSentence.text}</blockquote>
          <div className="courage-card__characters"><Character kind="fox" size="small" mood="happy" /><Character kind="tingting" size="small" mood="happy" /></div>
          <small>{story.title} · 今天的小小冒险</small>
        </article>
        <aside className="parent-bridge">
          <p>给一起玩的你</p>
          <section><span>聊一个问题</span><h3>{story.parentQuestion}</h3></section>
          <section><span>做一个小动作</span><h3>{story.familyAction}</h3></section>
          <div className="parent-bridge__note">不必追问现实里的每个细节。让故事先成为你们之间的一座小桥。</div>
          <div className="dual-actions"><GhostButton onClick={() => dispatch({ type: 'REWIND' })}>↶ 换一句再看看</GhostButton><PrimaryButton onClick={() => dispatch({ type: 'RESTART' })}>完成故事</PrimaryButton></div>
        </aside>
      </div>
    </StoryShell>
  )
}

export default function App() {
  const [state, dispatch] = useReducer(storyReducer, initialStoryState)

  useEffect(() => {
    // Every page of the picture book is a new scene. Keep the previous form's
    // scroll position from dropping children into the middle of the next page.
    if (!navigator.userAgent.includes('jsdom')) window.scrollTo({ top: 0, behavior: 'auto' })
  }, [state.step])

  switch (state.step) {
    case 'setup': return <SetupPage state={state} dispatch={dispatch} />
    case 'cover': return <CoverPage state={state} dispatch={dispatch} />
    case 'emotion': return <EmotionPage state={state} dispatch={dispatch} />
    case 'companions': return <CompanionsPage state={state} dispatch={dispatch} />
    case 'perspective': return <PerspectivePage state={state} dispatch={dispatch} />
    case 'sentence': return <SentencePage state={state} dispatch={dispatch} />
    case 'outcome': return <OutcomePage state={state} dispatch={dispatch} />
    case 'card': return <CardPage state={state} dispatch={dispatch} />
  }
}
