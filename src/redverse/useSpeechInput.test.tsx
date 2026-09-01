import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { useSpeechInput } from './useSpeechInput'

function useSpeechHarness(initial = '') {
  const [text, setText] = useState(initial)
  return { text, speech: useSpeechInput(setText) }
}

describe('speech input progressive enhancement', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ asrEnabled: false }), { status: 200 })))
  })
  afterEach(() => {
    delete (window as typeof window & { SpeechRecognition?: unknown }).SpeechRecognition
    vi.unstubAllGlobals()
  })

  it('keeps text input available when recognition is unsupported', () => {
    const { result } = renderHook(() => useSpeechHarness())
    expect(result.current.speech.supported).toBe(false)
    act(() => result.current.speech.toggle())
    expect(result.current.speech.error).toContain('继续使用文字')
  })

  it('returns a recognized transcript and stops listening', () => {
    class RecognitionStub {
      static latest: RecognitionStub | undefined
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }> }) => void) | null = null
      onerror: (() => void) | null = null
      onend: (() => void) | null = null
      constructor() { RecognitionStub.latest = this }
      start() {}
      stop() { this.onend?.() }
    }
    ;(window as typeof window & { SpeechRecognition?: typeof RecognitionStub }).SpeechRecognition = RecognitionStub
    const { result } = renderHook(() => useSpeechHarness('原有内容'))

    act(() => result.current.speech.toggle())
    expect(result.current.speech.listening).toBe(true)
    act(() => {
      RecognitionStub.latest?.onresult?.({ results: [{ 0: { transcript: '我想先核对事实' }, isFinal: false }] })
    })
    expect(result.current.text).toBe('原有内容 我想先核对事实')
    act(() => {
      RecognitionStub.latest?.onresult?.({ results: [{ 0: { transcript: '我想先核对事实' }, isFinal: true }] })
      RecognitionStub.latest?.onend?.()
    })
    expect(result.current.text).toBe('原有内容 我想先核对事实')
    expect(result.current.speech.listening).toBe(false)
  })

  it('records with MediaRecorder and sends audio to MiMo ASR when configured', async () => {
    const stopTrack = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ asrEnabled: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: '先观察门外的人' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } })
    class RecorderStub {
      static latest: RecorderStub
      static isTypeSupported() { return true }
      state = 'inactive'
      mimeType = 'audio/webm;codecs=opus'
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onerror: (() => void) | null = null
      onstop: (() => void) | null = null
      constructor() { RecorderStub.latest = this }
      start() { this.state = 'recording' }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) }); this.onstop?.() }
    }
    vi.stubGlobal('MediaRecorder', RecorderStub)
    const { result } = renderHook(() => useSpeechHarness())
    await waitFor(() => expect(result.current.speech.provider).toBe('mimo-v2.5-asr'))
    await act(async () => result.current.speech.toggle())
    expect(result.current.speech.listening).toBe(true)
    await act(async () => result.current.speech.toggle())
    await waitFor(() => expect(result.current.text).toBe('先观察门外的人'))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/asr', expect.objectContaining({ method: 'POST' }))
    expect(stopTrack).toHaveBeenCalled()
  })
})
