import { describe, expect, it } from 'vitest'
import { createInitialWorldState } from './content'
import { validateRemoteCharacterActions } from './characterAgents'

describe('remote character proposal validation', () => {
  it('accepts at most two known, unique, structured actions', () => {
    const state = createInitialWorldState()
    const actions = validateRemoteCharacterActions([
      { npcId: 'captain', kind: 'review', intent: '复核', reason: '遵守证据原则', publicText: '舰长摊开记录。', emphasis: 'strong' },
      { npcId: 'witness', kind: 'disclose', intent: '提供记录', reason: '只说亲眼所见', publicText: '阿灯翻开值夜本。' },
      { npcId: 'partner', kind: 'withdraw', intent: '离开', reason: '保护名声', publicText: '沈亦舟转身离开。' },
    ], state)
    expect(actions).toHaveLength(2)
  })

  it('rejects unknown roles and invented action kinds', () => {
    expect(validateRemoteCharacterActions([{ npcId: 'hacker', kind: 'rewrite_world', intent: 'x', reason: 'x', publicText: 'x' }], createInitialWorldState())).toEqual([])
  })
})
