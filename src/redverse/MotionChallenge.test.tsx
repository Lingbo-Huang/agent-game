import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MotionChallenge } from './MotionChallenge'

describe('MotionChallenge', () => {
  afterEach(() => vi.useRealTimers())

  it('allows the no-camera fallback to produce the same completion event', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<MotionChallenge onClose={() => undefined} onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: '键盘降级 · Space' }))
    expect(screen.getByRole('status').textContent).toContain('键盘降级')
    vi.advanceTimersByTime(900)
    expect(onComplete).toHaveBeenCalledWith('fallback')
  })

  it('supports Space as an accessible fallback control', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<MotionChallenge onClose={() => undefined} onComplete={onComplete} />)
    fireEvent.keyDown(window, { code: 'Space' })
    vi.advanceTimersByTime(900)
    expect(onComplete).toHaveBeenCalledWith('fallback')
  })
})
