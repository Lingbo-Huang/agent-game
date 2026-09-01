import { useEffect, useMemo, useState } from 'react'

const completedCaptions = new Set<string>()

function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  return normalized.match(/[^。！？!?]+[。！？!?]?/g)?.map((item) => item.trim()).filter(Boolean) ?? [normalized]
}

interface TypewriterSubtitleProps {
  text: string
  className?: string
  onComplete?: () => void
  /** Previously shown captions should never replay at typing speed. */
  instant?: boolean
  kind?: 'narration' | 'dialogue' | 'suspense' | 'warning' | 'feedback'
}

export function TypewriterSubtitle({ text, className = '', onComplete, instant = false, kind = 'narration' }: TypewriterSubtitleProps) {
  const sentences = useMemo(() => splitSentences(text), [text])
  const [sentenceIndex, setSentenceIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [completed, setCompleted] = useState(false)
  const current = sentences[sentenceIndex] ?? ''
  const immediate = kind === 'warning' || kind === 'feedback'
  const alreadyRead = completedCaptions.has(text)
  const showWholeCaption = reduceMotion || instant || immediate || alreadyRead
  const finished = sentences.length === 0 || (sentenceIndex === sentences.length - 1 && charIndex >= current.length)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduceMotion(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    setSentenceIndex(0)
    setCharIndex(showWholeCaption ? (sentences[0]?.length ?? 0) : 0)
    setCompleted(false)
  }, [sentences, showWholeCaption, text])

  useEffect(() => {
    if (!current) {
      if (!completed) {
        setCompleted(true)
        onComplete?.()
      }
      return
    }
    if (showWholeCaption) {
      setSentenceIndex(Math.max(0, sentences.length - 1))
      setCharIndex(sentences.at(-1)?.length ?? 0)
      if (!completed) {
        completedCaptions.add(text)
        setCompleted(true)
        onComplete?.()
      }
      return
    }
    if (charIndex < current.length) {
      const currentChar = current[charIndex] ?? ''
      // Chinese captions are paced by readable characters per second:
      // narration ≈9.5, dialogue ≈11, suspense at most 20% slower.
      const baseDelay = kind === 'dialogue' ? 91 : kind === 'suspense' ? 120 : 105
      const timer = window.setTimeout(() => setCharIndex((value) => value + 1), /[。！？!?]/.test(currentChar) ? baseDelay + 66 : /[，；：,;:]/.test(currentChar) ? baseDelay + 20 : baseDelay)
      return () => window.clearTimeout(timer)
    }
    if (sentenceIndex < sentences.length - 1) {
      const timer = window.setTimeout(() => {
        setSentenceIndex((value) => value + 1)
        setCharIndex(0)
      }, 360)
      return () => window.clearTimeout(timer)
    }
    if (!completed) {
      completedCaptions.add(text)
      setCompleted(true)
      onComplete?.()
    }
  }, [charIndex, completed, current, kind, onComplete, sentenceIndex, sentences, showWholeCaption, text])

  function skip() {
    if (finished) return
    if (charIndex < current.length) {
      setCharIndex(current.length)
      return
    }
    setSentenceIndex((value) => Math.min(value + 1, sentences.length - 1))
    setCharIndex(0)
  }

  if (!current) return null
  return (
    <button type="button" className={`typewriter-subtitle ${className}`} onClick={skip} aria-label={finished ? '字幕播放完毕' : '显示完整字幕'}>
      <span>{showWholeCaption ? text : current.slice(0, charIndex)}</span>
      {!finished && <i aria-hidden="true" />}
      <small>{finished ? '剧情已推进' : '点击显示本句'}</small>
    </button>
  )
}
