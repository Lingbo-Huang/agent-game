import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TypewriterSubtitle } from './TypewriterSubtitle'

describe('TypewriterSubtitle pacing', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    })
  })

  afterEach(() => cleanup())

  it('shows every sentence of an action feedback immediately', () => {
    render(<TypewriterSubtitle kind="feedback" text="抽屉是空的。夹层也没有留下纸条。" />)
    expect(screen.getByText('抽屉是空的。夹层也没有留下纸条。')).toBeTruthy()
  })

  it('shows every sentence of a danger warning immediately', () => {
    render(<TypewriterSubtitle kind="warning" text="门外有人。脚步停在门前。" />)
    expect(screen.getByText('门外有人。脚步停在门前。')).toBeTruthy()
  })

  it('does not replay a caption that has already completed', () => {
    const text = '这句旁白已经读过。'
    const first = render(<TypewriterSubtitle instant text={text} />)
    first.unmount()
    render(<TypewriterSubtitle text={text} />)
    expect(screen.getByText(text)).toBeTruthy()
  })
})
