import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { progressSteps } from '../content/story'
import type { StoryStep } from '../types'
import { TypewriterSubtitle } from './TypewriterSubtitle'
import { useMimoVoice } from '../redverse/useMimoVoice'

interface StoryShellProps {
  step: StoryStep
  title: string
  prompt?: string
  storyTitle?: string
  children: ReactNode
  action?: ReactNode
  voiceScript?: ChildVoiceLine[]
  onExit: () => void
}

export interface ChildVoiceLine {
  text: string
  speaker?: 'child_narrator' | 'fox' | 'bear' | 'chongchong' | 'manman' | 'tingting'
  delivery?: string
}

const READ_ALONG_KEY = 'echoforge:child-read-along'
const sceneDirections: Partial<Record<StoryStep, string>> = {
  emotion: '像翻开绘本一样温柔。先给情绪留一点安静，问句轻轻上扬，不催孩子回答。',
  companions: '活泼但不吵闹，介绍三个主意时带一点好奇，强调没有标准答案。',
  perspective: '像发现一块新拼图，前半句略带惊讶，后半句放慢，不替任何角色判对错。',
  sentence: '鼓励但不喊口号，在“说一句话”前留短停顿，让孩子感到自己可以选择。',
  outcome: '像故事抵达一个温暖转折，有画面感；不要说教，结尾留一点余韵。',
  card: '温暖、欣慰，像把一张小卡片交到孩子手里；语速稍慢，句尾柔和。',
}

export function StoryShell({ step, title, prompt, storyTitle = '森林音乐会少了一把椅子', children, action, voiceScript, onExit }: StoryShellProps) {
  const currentIndex = progressSteps.findIndex((item) => item.step === step)
  const page = currentIndex + 1
  const voice = useMimoVoice()
  const { configured, speak, stop } = voice
  const [readAlong, setReadAlong] = useState(() => window.sessionStorage.getItem(READ_ALONG_KEY) === 'on')
  const spokenRef = useRef('')
  const sceneDirection = sceneDirections[step] || '温暖自然地讲绘本。'
  const script = useMemo<ChildVoiceLine[]>(() => voiceScript?.length ? voiceScript : [{
    text: `${title}。${prompt || ''}`,
    speaker: 'child_narrator',
    delivery: sceneDirection,
  }], [prompt, sceneDirection, title, voiceScript])
  const scriptKey = script.map((line) => `${line.speaker}:${line.text}`).join('|')
  const playScript = useCallback(async () => {
    if (!configured) return
    stop()
    for (const line of script) {
      const played = await speak(line.text, line.speaker || 'child_narrator', line.delivery || sceneDirection)
      if (!played) break
    }
  }, [configured, sceneDirection, script, speak, stop])

  useEffect(() => {
    if (!readAlong || !configured || spokenRef.current === scriptKey) return
    spokenRef.current = scriptKey
    void playScript()
  }, [configured, playScript, readAlong, scriptKey])

  function toggleReadAlong() {
    const next = !readAlong
    setReadAlong(next)
    window.sessionStorage.setItem(READ_ALONG_KEY, next ? 'on' : 'off')
    if (next) {
      spokenRef.current = scriptKey
      void playScript()
    } else stop()
  }

  return (
    <main className="story-app">
      <header className="story-header">
        <button className="brand brand--button" onClick={onExit} aria-label="退出故事并返回开始">
          <span className="brand__mark">✦</span>
          <span>小小冒险</span>
        </button>
        <div className="privacy-note"><span /> 这次故事不会保存</div>
        <button type="button" className={`story-voice ${readAlong ? 'is-on' : ''}`} disabled={!voice.configured || voice.preparing} onClick={toggleReadAlong} aria-pressed={readAlong} aria-label={readAlong ? '关闭自动陪读' : '开启自动陪读'}>{voice.preparing ? '角色正在准备…' : voice.playing ? '正在讲故事…（点此关闭）' : readAlong ? '🔊 自动陪读已开' : '▶ 开启自动陪读'}</button>
        <div className="page-count" aria-label={`第 ${page} 页，共 6 页`}>{page} / 6</div>
      </header>

      <section className="story-layout">
        <div className="story-copy">
          <p className="story-kicker">{storyTitle}</p>
          <h1>{title}</h1>
          {prompt && <p className="story-prompt">{prompt}</p>}
        </div>
        <div className="story-content">
          {children}
          {prompt && <TypewriterSubtitle className="story-subtitle" text={prompt} />}
        </div>
        {action && <div className="story-action">{action}</div>}
      </section>
      {voice.error && <small className="story-voice-error" role="alert">配音暂时没有成功：{voice.error}</small>}

      <nav className="story-rail" aria-label="故事进度">
        {progressSteps.map((item, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming'
          return (
            <div className={`story-rail__item story-rail__item--${state}`} key={item.step} aria-current={state === 'current' ? 'step' : undefined}>
              <span>{state === 'done' ? '✓' : index + 1}</span>
              <small>{item.label}</small>
            </div>
          )
        })}
      </nav>
    </main>
  )
}
