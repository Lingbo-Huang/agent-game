import { useCallback, useEffect, useRef, useState } from 'react'
import type { LocationId, WorldState } from './types'

type AudioContextLike = AudioContext

function createNoiseBuffer(context: AudioContextLike) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1
  return buffer
}

/** 用户主动开启后，用 Web Audio 合成低音量环境声；不加载第三方音频。 */
interface SoundscapeOptions {
  locationId?: LocationId
  progress?: number
}

/**
 * 用户主动开启后，用 Web Audio 合成低音量环境声；不加载第三方音频。
 * 天气控制噪声质感，地点控制空间音高，进度只做克制的紧张度变化。
 */
export function useSoundscape(weather: WorldState['weather'], options: SoundscapeOptions = {}) {
  const [enabled, setEnabled] = useState(false)
  const contextRef = useRef<AudioContextLike | null>(null)
  const nodesRef = useRef<AudioNode[]>([])

  const stop = useCallback(() => {
    nodesRef.current.forEach((node) => { try { node.disconnect() } catch { /* no-op */ } })
    nodesRef.current = []
  }, [])

  const start = useCallback(() => {
    stop()
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return
    const context = contextRef.current || new Context()
    contextRef.current = context
    void context.resume()
    const master = context.createGain()
    master.gain.value = .025
    master.connect(context.destination)
    const noise = context.createBufferSource()
    noise.buffer = createNoiseBuffer(context)
    noise.loop = true
    const filter = context.createBiquadFilter()
    filter.type = weather === 'rain' ? 'highpass' : 'lowpass'
    filter.frequency.value = weather === 'rain' ? 900 : weather === 'fog' ? 260 : 420
    noise.connect(filter).connect(master)
    noise.start()
    const hum = context.createOscillator()
    const humGain = context.createGain()
    hum.type = 'sine'
    const locationPitch: Partial<Record<LocationId, number>> = {
      deck: 82,
      chart_room: 96,
      crow_nest: 116,
      captain_room: 72,
    }
    hum.frequency.value = weather === 'fog' ? 62 : (locationPitch[options.locationId ?? 'deck'] ?? 82) + Math.min(12, Math.max(0, options.progress ?? 0) * 3)
    humGain.gain.value = weather === 'rain' ? .08 : .16
    hum.connect(humGain).connect(master)
    hum.start()
    nodesRef.current = [noise, filter, hum, humGain, master]
  }, [options.locationId, options.progress, stop, weather])

  useEffect(() => {
    if (enabled) start()
    else stop()
    return stop
  }, [enabled, start, stop, weather])
  useEffect(() => () => { stop(); void contextRef.current?.close() }, [stop])

  const ping = useCallback((kind: 'choice' | 'clue') => {
    if (!enabled || !contextRef.current) return
    const context = contextRef.current
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = kind === 'clue' ? 660 : 420
    oscillator.type = 'sine'
    gain.gain.setValueAtTime(.035, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .22)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + .24)
  }, [enabled])

  const locationLabel: Partial<Record<LocationId, string>> = {
    deck: '甲板风浪',
    chart_room: '制图室钟摆',
    crow_nest: '高处风鸣',
    captain_room: '舰长室低鸣',
  }

  return {
    enabled,
    supported: typeof window !== 'undefined' && Boolean(window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext),
    label: `${locationLabel[options.locationId ?? 'deck'] ?? '世界声景'} · ${weather === 'rain' ? '雨声' : weather === 'fog' ? '雾中低鸣' : '平静环境'}`,
    toggle: () => setEnabled((value) => !value),
    ping,
  }
}
