import { describe, expect, it } from 'vitest'
import { createInitialWorldState } from './content'
import { getAvailableQuickActions, proposeCharacterActions, resolveTurn, runCharacterPulse } from './engine'

describe('character agent runtime', () => {
  it('keeps immutable constitution separate from mutable runtime state', () => {
    const state = createInitialWorldState()
    const beforePrinciples = ['从不当众承认功劳有争议', '在乎自己在船员中的名声，胜过在乎事实本身']
    state.actionCounts['talk:partner'] = 2

    const actions = runCharacterPulse(state, {
      clientActionId: 'talk-3', type: 'talk', targetId: 'partner',
    })

    expect(actions[0]).toMatchObject({ npcId: 'partner', kind: 'withdraw', toLocationId: 'chart_room' })
    expect(state.npcStates.partner.currentLocationId).toBe('chart_room')
    expect(state.npcStates.partner.recentMemories).toHaveLength(1)
    expect(beforePrinciples).toEqual(['从不当众承认功劳有争议', '在乎自己在船员中的名声，胜过在乎事实本身'])
  })

  it('returns auditable character actions as part of a turn', () => {
    const state = createInitialWorldState()
    state.flags.proof_presented = true
    const resolved = resolveTurn(state, { clientActionId: 'wait-1', type: 'wait' })

    expect(resolved.result.characterActions[0]).toMatchObject({ npcId: 'captain', kind: 'review' })
    expect(resolved.result.narration).toContain('【角色行动】')
    expect(resolved.state.npcStates.captain.lastAction?.reason).toContain('证据链')
  })

  it('lets all relevant characters propose before the director applies a two-action budget', () => {
    const state = createInitialWorldState()
    state.currentTurn = 3
    state.flags.proof_presented = true
    state.clues.clue_night_log = 'discovered'

    const proposals = proposeCharacterActions(state, { clientActionId: 'parallel-1', type: 'wait' })
    const approved = runCharacterPulse(state, { clientActionId: 'parallel-1', type: 'wait' })

    expect(proposals.map((action) => action.npcId)).toEqual(expect.arrayContaining(['captain', 'witness']))
    expect(approved).toHaveLength(2)
  })

  it('does not let a character move into a locked location', () => {
    const state = createInitialWorldState()
    state.actionCounts['talk:partner'] = 2
    state.discoveredLocationIds = ['deck', 'captain_room']

    const actions = runCharacterPulse(state, {
      clientActionId: 'talk-3', type: 'talk', targetId: 'partner',
    })

    expect(actions).toEqual([])
    expect(state.npcStates.partner.currentLocationId).toBe('deck')
  })

  it('changes the offered actions after the world advances', () => {
    const initial = createInitialWorldState()
    const first = getAvailableQuickActions(initial).actions
    expect(first.some((action) => action.label === '留意搭档的反应')).toBe(true)

    const observed = resolveTurn(initial, { clientActionId: 'observe-1', type: 'observe', targetId: 'deck' }).state
    const second = getAvailableQuickActions(observed).actions
    expect(second.some((action) => action.label === '留意搭档的反应')).toBe(false)
    expect(second.some((action) => action.type === 'investigate')).toBe(true)
  })

  it('does not keep offering exhausted conversations', () => {
    const state = createInitialWorldState()
    state.actionCounts['talk:partner'] = 3
    const actions = getAvailableQuickActions(state).actions
    expect(actions.some((action) => action.targetId === 'partner')).toBe(false)
  })

  it('settles a retried client action id exactly once', () => {
    const initial = createInitialWorldState()
    const action = { clientActionId: 'same-action-id', type: 'observe' as const, targetId: 'deck' }
    const first = resolveTurn(initial, action)
    const retry = resolveTurn(first.state, action)

    expect(retry.state.currentTurn).toBe(first.state.currentTurn)
    expect(retry.state.log).toEqual(first.state.log)
    expect(retry.state.actionCounts).toEqual(first.state.actionCounts)
    expect(retry.result.narration).toBe('')
  })

  it('offers an explicit, deterministic route from two clues to the truth ending', () => {
    const ready = createInitialWorldState()
    ready.clues.clue_draft_map = 'discovered'
    ready.clues.clue_night_log = 'discovered'

    const combine = getAvailableQuickActions(ready).actions.find((action) => action.id === 'use:clue_combined_proof')
    expect(combine?.tone).toBe('important')

    const connected = resolveTurn(ready, {
      clientActionId: 'combine-proof', type: 'use', targetId: 'clue_combined_proof',
    }).state
    expect(connected.clues.clue_combined_proof).toBe('connected')
    expect(connected.flags.proof_presented).toBe(false)
    expect(connected.flags.ending_reached).toBe(false)

    const goToCaptain = getAvailableQuickActions(connected).actions.find((action) => action.id === 'move:captain_room')
    expect(goToCaptain?.label).toContain('提交复核')

    const arrived = resolveTurn(connected, {
      clientActionId: 'go-captain', type: 'move', targetId: 'captain_room',
    }).state
    const submit = getAvailableQuickActions(arrived).actions.find((action) => action.id === 'talk:captain')
    expect(submit?.label).toContain('证据链')

    const ended = resolveTurn(arrived, {
      clientActionId: 'submit-proof', type: 'talk', targetId: 'captain',
    }).state
    expect(ended.flags.ending_reached).toBe(true)
    expect(ended.flags.proof_presented).toBe(true)
    expect(ended.activeWorldline).toBe('truth')
    expect(ended.flags.ending_kind).toBe('truth')
  })

  it('offers a soft deadline fork and only ends when the player accepts moving on', () => {
    let state = createInitialWorldState()
    for (let turn = 1; turn <= 11; turn += 1) {
      state = resolveTurn(state, { clientActionId: `wait-${turn}`, type: 'wait' }).state
    }

    expect(state.activeWorldline).toBe('undetermined')
    expect(state.flags.ending_reached).toBe(false)

    state = resolveTurn(state, { clientActionId: 'wait-12', type: 'wait' }).state
    expect(state.currentTurn).toBe(12)
    expect(state.activeWorldline).toBe('undetermined')
    expect(state.flags.ending_reached).toBe(false)
    const accept = getAvailableQuickActions(state).actions.find((action) => action.id === 'accept-forgetting')
    expect(accept?.label).toContain('接受翻篇')

    state = resolveTurn(state, { clientActionId: 'accept-ending', type: 'wait', targetId: 'accept-forgetting' }).state
    expect(state.activeWorldline).toBe('forgetting')
    expect(state.flags.ending_reached).toBe(true)
    expect(state.flags.ending_kind).toBe('forgetting')
    expect(getAvailableQuickActions(state).actions).toEqual([])
  })
})
