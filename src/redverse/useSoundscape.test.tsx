import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSoundscape } from './useSoundscape'
import type { LocationId, WorldState } from './types'

describe('soundscape progressive enhancement', () => {
  it('stays off by default and keeps an explicit user control', () => {
    const { result } = renderHook(() => useSoundscape('clear'))
    expect(result.current.enabled).toBe(false)
    act(() => result.current.toggle())
    expect(result.current.enabled).toBe(true)
  })

  it('describes the live layer from location and weather', () => {
    const { result, rerender } = renderHook(
      ({ weather, locationId }) => useSoundscape(weather, { locationId, progress: 3 }),
      { initialProps: { weather: 'clear' as WorldState['weather'], locationId: 'chart_room' as LocationId } },
    )
    expect(result.current.label).toBe('制图室钟摆 · 平静环境')
    rerender({ weather: 'rain', locationId: 'crow_nest' })
    expect(result.current.label).toBe('高处风鸣 · 雨声')
  })
})
