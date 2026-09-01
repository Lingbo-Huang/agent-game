import { describe, expect, it } from 'vitest'
import { createInitialWorldState } from './content'
import { resolveTurn } from './engine'
import { buildUnderstandingPath } from './understandingPath'
import { compileWorld } from './worldCompiler'

describe('understanding path', () => {
  it('is grounded in actual action history instead of inventing a story tree', () => {
    const source = '同事汇报时没有提我的贡献。'
    const world = compileWorld(source)
    const { state } = resolveTurn(createInitialWorldState(), { clientActionId: 'observe-1', type: 'observe', targetId: 'deck' }, world)
    const path = buildUnderstandingPath(source, state, world)
    expect(path).toHaveLength(5)
    expect(path[1].title).toContain('观察')
    expect(path[0].detail).toContain('不自动等于')
    expect(path[4].detail).toContain('回响卡')
  })
})
