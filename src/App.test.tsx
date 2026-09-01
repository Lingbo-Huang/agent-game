import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { compileChildStory } from './content/story'

describe('children route adult gate', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    })
  })
  afterEach(cleanup)
  it('requires an adult confirmation and blocks identifying details', () => {
    render(<App />)
    const start = screen.getByRole('button', { name: /生成今天的小冒险/ }) as HTMLButtonElement
    expect(start.disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(start.disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('今天发生了什么？'), { target: { value: '我家住在彩虹路，我的学校是森林小学' } })
    fireEvent.click(start)
    expect(screen.getByRole('alert').textContent).toContain('真实信息不用告诉故事')
    expect(screen.getByText(/不是 AI 朋友/)).toBeTruthy()
  })

  it('completes the child story through feeling, perspective and expression', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /生成今天的小冒险/ }))
    fireEvent.click(screen.getByRole('button', { name: /翻开故事/ }))
    fireEvent.click(screen.getByRole('radio', { name: /一块缩起来的石头/ }))
    fireEvent.click(screen.getByRole('button', { name: /带着这种感觉/ }))
    fireEvent.click(screen.getByRole('radio', { name: /听听/ }))
    fireEvent.click(screen.getByRole('button', { name: /带着这个主意/ }))
    expect((screen.getByAltText(/五位伙伴来到夜晚的森林音乐会/) as HTMLImageElement).src).toContain('forest-concert-opening.webp')
    fireEvent.click(screen.getByRole('button', { name: /坐到小熊的位置/ }))
    expect((screen.getByAltText(/从小熊的位置重看森林音乐会/) as HTMLImageElement).src).toContain('perspective-reveal-v1.webp')
    fireEvent.click(screen.getByRole('button', { name: /带着新线索/ }))
    fireEvent.click(screen.getByRole('radio', { name: /刚才没有人问我/ }))
    fireEvent.click(screen.getByRole('button', { name: /说出这句话/ }))
    expect((screen.getByAltText(/从小熊的位置重看森林音乐会/) as HTMLImageElement).src).toContain('outcome-bridge-v1.webp')
    fireEvent.click(screen.getByRole('button', { name: /收下今天的勇气卡/ }))
    expect(screen.getByRole('heading', { name: /这份勇气，可以带回明天/ })).toBeTruthy()
    expect(screen.getByText('给一起玩的你')).toBeTruthy()
  })

  it('compiles different low-risk picture books from the parent context', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('今天发生了什么？'), { target: { value: '孩子比赛失败后一直说自己什么都做不好' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /生成今天的小冒险/ }))

    expect(screen.getByRole('heading', { name: '风筝比赛里的一阵乱风' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /翻开故事/ }))
    fireEvent.click(screen.getByRole('radio', { name: /一块缩起来的石头/ }))
    fireEvent.click(screen.getByRole('button', { name: /带着这种感觉/ }))
    fireEvent.click(screen.getByRole('radio', { name: /听听/ }))
    fireEvent.click(screen.getByRole('button', { name: /带着这个主意/ }))
    fireEvent.click(screen.getByRole('button', { name: /坐到小熊的位置/ }))
    fireEvent.click(screen.getByRole('button', { name: /带着新线索/ }))

    expect(screen.getByRole('radio', { name: /它不等于我什么都做不好/ })).toBeTruthy()
  })

  it('adapts the picture book to age and learning goal', () => {
    const young = compileChildStory('今天没有被邀请参加游戏', '4-6', '被拒绝后照顾自己')
    const older = compileChildStory('今天没有被邀请参加游戏', '10-12', '试着看见别人')

    expect(young.sentences[0].id).toBe('leave')
    expect(young.parentQuestion).toContain('抱抱你')
    expect(older.sentences[0].id).toBe('boundary')
    expect(older.familyAction).toContain('事实')
    expect(older.cardTitle).not.toBe(young.cardTitle)
  })
})
