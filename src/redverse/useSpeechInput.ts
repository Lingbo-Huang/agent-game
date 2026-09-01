import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

interface SpeechRecognitionEventLike {
  resultIndex?: number
  results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }>
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type RecognitionConstructor = new () => SpeechRecognitionLike

function appendWithSpace(value: string, text: string) {
  const clean = text.trim()
  if (!clean) return value
  return `${value}${value && !/\s$/.test(value) ? ' ' : ''}${clean}`
}

/**
 * Live dictation prefers the browser's streaming recognizer because MiMo's
 * current HTTP ASR endpoint returns only after a complete recording is sent.
 * On browsers without streaming recognition we retain MiMo as a stop-to-send
 * fallback, so voice input never removes the normal text path.
 */
export function useSpeechInput(setText: Dispatch<SetStateAction<string>>) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [asrEnabled, setAsrEnabled] = useState(false)
  const [error, setError] = useState('')
  const interimRef = useRef('')
  const Recognition = typeof window === 'undefined'
    ? undefined
    : ((window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition)

  useEffect(() => {
    let cancelled = false
    fetch('/api/status').then((response) => response.json()).then((status) => {
      if (!cancelled) setAsrEnabled(Boolean(status.asrEnabled))
    }).catch(() => undefined)
    return () => {
      cancelled = true
      recognitionRef.current?.stop()
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function startBrowserRecognition() {
    if (!Recognition) {
      setError('当前浏览器无法录音，请继续使用文字。')
      return
    }
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      const start = event.resultIndex ?? 0
      for (let index = start; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result?.[0]?.transcript || ''
        if (result?.isFinal) finalText += transcript
        else interimText += transcript
      }

      const previousInterim = interimRef.current
      interimRef.current = interimText.trim()
      setText((current) => {
        const base = previousInterim && current.endsWith(previousInterim)
          ? current.slice(0, -previousInterim.length).trimEnd()
          : current
        return appendWithSpace(appendWithSpace(base, finalText), interimRef.current)
      })
    }
    recognition.onerror = () => { setError('没有听清或没有麦克风权限，请继续使用文字。'); setListening(false) }
    recognition.onend = () => { interimRef.current = ''; setListening(false) }
    setError('')
    setListening(true)
    recognition.start()
  }

  async function transcribe(blob: Blob) {
    if (!blob.size) throw new Error('没有录到声音，请再试一次。')
    const audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('无法读取录音。'))
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
      reader.readAsDataURL(blob)
    })
    const response = await fetch('/api/asr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio, mime: blob.type || 'audio/webm' }),
    })
    const data = await response.json().catch(() => ({})) as { text?: string; error?: string }
    if (!response.ok || !data.text) throw new Error(data.error || '语音识别暂时不可用。')
    setText((value) => appendWithSpace(value, data.text || ''))
  }

  async function startMimoRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined)
      const chunks: Blob[] = []
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => { setError('录音失败，请检查麦克风权限。'); setListening(false) }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setListening(false)
        setTranscribing(true)
        void transcribe(new Blob(chunks, { type: recorder.mimeType || preferred || 'audio/webm' }))
          .catch((reason) => setError(reason instanceof Error ? reason.message : '语音识别失败。'))
          .finally(() => setTranscribing(false))
      }
      setError('')
      setListening(true)
      recorder.start()
    } catch {
      setError('没有麦克风权限，请允许访问后再试。')
      setListening(false)
    }
  }

  function toggle() {
    if (transcribing) return
    if (listening) {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      recognitionRef.current?.stop()
      return
    }
    // Streaming browser recognition is the only currently available way to
    // show words while the user is still speaking. MiMo remains the higher
    // compatibility fallback when that API is unavailable.
    if (Recognition) startBrowserRecognition()
    else if (asrEnabled && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)) void startMimoRecording()
    else startBrowserRecognition()
  }

  const canRecord = asrEnabled && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  return { supported: canRecord || Boolean(Recognition), listening, transcribing, error, toggle, provider: Recognition ? 'browser-live' : canRecord ? 'mimo-v2.5-asr' : 'none' }
}
