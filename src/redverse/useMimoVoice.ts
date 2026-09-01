import { useCallback, useEffect, useRef, useState } from 'react'

const SESSION_KEY = 'redverse:mimo-key'
// Never bundle a provider credential into browser JavaScript. A user may enter
// a key for the current tab, or configure the server-side proxy instead.
const DEFAULT_DEMO_KEY = ''
const PRESET_VOICES: Record<string, string> = {
  narrator: '茉莉', partner: '苏打', witness: '冰糖', captain: '白桦',
  child_narrator: '茉莉', fox: '冰糖', bear: '苏打', chongchong: '冰糖', manman: '白桦', tingting: '茉莉',
}

// Public only for format validation tests; provider credentials are never
// accepted or stored by the deployed browser application.
export function isMimoApiKey(value: string) {
  return /^(sk|tp)-[A-Za-z0-9_-]{24,}$/.test(value.trim())
}

async function requestAudio(text: string, speaker: string, delivery: string) {
  const directKey = window.sessionStorage.getItem(SESSION_KEY) || DEFAULT_DEMO_KEY
  if (isMimoApiKey(directKey)) {
    try {
      return await requestDirectAudio(directKey, text, speaker, delivery)
    } catch (directError) {
      // Keep the server route as a second path when a proxy is configured. If
      // both paths fail, surface the direct error,
      // which is generally more actionable (quota/CORS/model permission).
      const serverResult = await requestServerAudio(text, speaker, delivery).catch(() => null)
      if (serverResult) return serverResult
      throw directError
    }
  }
  return requestServerAudio(text, speaker, delivery)
}

async function requestServerAudio(text: string, speaker: string, delivery: string) {
  const serverResponse = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speaker, delivery }),
  })
  const serverData = await serverResponse.json().catch(() => ({})) as { audio?: string; mime?: string; error?: string }
  if (serverResponse.ok && serverData.audio) return { audio: serverData.audio, mime: serverData.mime || 'audio/wav' }

  if (serverResponse.status === 402) throw new Error('MiMo 套餐额度不足，充值 Token Plan 后重试；剧情仍可继续。')
  if (serverResponse.status === 429) throw new Error('MiMo 当前请求较多，请稍后重试；剧情仍可继续。')
  throw new Error(serverData.error || `MiMo 配音暂时不可用（${serverResponse.status}）`)
}

async function requestDirectAudio(sessionKey: string, text: string, speaker: string, delivery: string) {
  const identities: Record<string, string> = {
    captain: '低沉稳重、重视边界和程序的资深裁决者', witness: '安静敏锐、只确认亲眼所见的年轻见证者', partner: '聪明自尊、略带防备的青年当事人',
    child_narrator: '蹲下来陪孩子看绘本的温暖讲述者，清亮柔和，不训话', fox: '敏感真诚、正在鼓起勇气的小狐狸', bear: '憨厚、明白后会认真回应的小熊',
    chongchong: '精力充沛、语速稍快的小鸟', manman: '慢吞吞但可靠、每句话都认真想过的乌龟', tingting: '轻柔、真诚好奇、善于倾听的小兔',
  }
  const identity = identities[speaker] || '温润克制、观察敏锐的电影叙事者'
  const mimoBaseURL = sessionKey.startsWith('tp-') ? 'https://token-plan-cn.xiaomimimo.com/v1' : 'https://api.xiaomimimo.com/v1'
  const response = await fetch(`${mimoBaseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': sessionKey },
    body: JSON.stringify({
      model: 'mimo-v2.5-tts',
      messages: [{ role: 'user', content: `角色：${identity}。场景：互动叙事关键转折。演绎指导：${delivery}` }, { role: 'assistant', content: text }],
      audio: { format: 'wav', voice: PRESET_VOICES[speaker] || PRESET_VOICES.narrator },
    }),
  })
  const data = await response.json().catch(() => ({})) as { choices?: Array<{ message?: { audio?: { data?: string } } }>; error?: { message?: string } }
  const audio = data.choices?.[0]?.message?.audio?.data
  if (!response.ok || !audio) {
    if (response.status === 402) throw new Error('MiMo 按量 API 额度不足。充值普通 API 余额后重试；剧情仍可继续。')
    if (response.status === 429) throw new Error('MiMo 当前请求较多，请稍后重试；剧情仍可继续。')
    throw new Error(data.error?.message || `MiMo 配音暂时不可用（${response.status}）`)
  }
  return { audio, mime: 'audio/wav' }
}

export function useMimoVoice() {
  const [configured, setConfigured] = useState(() => isMimoApiKey(window.sessionStorage.getItem(SESSION_KEY) || DEFAULT_DEMO_KEY))
  const [serverConfigured, setServerConfigured] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const finishPlaybackRef = useRef<(() => void) | null>(null)
  const queueRef = useRef(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    fetch('/api/status').then((response) => response.json()).then((status) => {
      if (!cancelled) {
        setServerConfigured(Boolean(status.ttsEnabled))
        setConfigured(Boolean(status.ttsEnabled) || isMimoApiKey(window.sessionStorage.getItem(SESSION_KEY) || DEFAULT_DEMO_KEY))
      }
    }).catch(() => { if (!cancelled) setConfigured(isMimoApiKey(window.sessionStorage.getItem(SESSION_KEY) || DEFAULT_DEMO_KEY)) })
    return () => { cancelled = true }
  }, [])

  const stop = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    finishPlaybackRef.current?.()
    finishPlaybackRef.current = null
    setPlaying(false)
  }, [])
  useEffect(() => stop, [stop])

  const speak = useCallback((text: string, speaker = 'narrator', delivery = '自然、克制、有画面感；不要逐字朗读；按句意停顿。') => {
    if (!configured || !text.trim()) return Promise.resolve(false)
    const task = queueRef.current.catch(() => undefined).then(async () => {
      setError('')
      setPreparing(true)
      const result = await requestAudio(text.slice(0, 900), speaker, delivery)
      setPreparing(false)
      stop()
      const player = new Audio(`data:${result.mime};base64,${result.audio}`)
      audioRef.current = player
      setPlaying(true)
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          finishPlaybackRef.current = null
          setPlaying(false)
          resolve()
        }
        finishPlaybackRef.current = finish
        player.onended = finish
        player.onerror = () => {
          if (settled) return
          settled = true
          finishPlaybackRef.current = null
          setPlaying(false)
          reject(new Error('音频播放失败'))
        }
        player.play().catch((reason) => {
          if (settled) return
          settled = true
          finishPlaybackRef.current = null
          setPlaying(false)
          reject(reason)
        })
      })
      return true
    }).catch((reason) => {
      setPreparing(false)
      setPlaying(false)
      setError(reason instanceof Error ? reason.message : 'MiMo 配音失败')
      return false
    })
    queueRef.current = task.then(() => undefined)
    return task
  }, [configured, stop])

  const saveSessionKey = useCallback((value: string) => {
    const key = value.trim()
    if (!isMimoApiKey(key)) throw new Error('请输入 MiMo API Key（普通按量 sk- 或 Token Plan tp-）。')
    window.sessionStorage.setItem(SESSION_KEY, key)
    setConfigured(true)
    setError('')
  }, [])

  const clearSessionKey = useCallback(() => {
    window.sessionStorage.removeItem(SESSION_KEY)
    stop()
    setConfigured(serverConfigured)
  }, [serverConfigured, stop])

  return { configured, serverConfigured, hasSessionKey: isMimoApiKey(window.sessionStorage.getItem(SESSION_KEY) || ''), preparing, playing, error, speak, stop, saveSessionKey, clearSessionKey }
}

export const MIMO_APPLICATION_URL = 'https://platform.xiaomimimo.com/#/console/api-keys'
