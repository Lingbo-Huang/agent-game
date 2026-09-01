import { createInitialWorldState } from '../src/redverse/content.ts'
import { resolveTurn, interpretFreeText } from '../src/redverse/engine.ts'
import type { PlayerAction, WorldState } from '../src/redverse/types.ts'

function log(state: WorldState, label: string) {
  console.log(`\n=== ${label} ===`)
  console.log('turn', state.currentTurn, state.currentTimeLabel, 'loc:', state.playerLocationId, 'worldline:', state.activeWorldline)
  console.log('discovered locations:', state.discoveredLocationIds)
  console.log('clues:', Object.entries(state.clues).filter(([, s]) => s !== 'hidden'))
  console.log('last narration:', state.log[state.log.length - 1]?.text)
}

let state = createInitialWorldState()
log(state, 'initial')

const actions: PlayerAction[] = [
  { clientActionId: '1', type: 'investigate', targetId: state.playerLocationId }, // deck: ink smudge
  { clientActionId: '2', type: 'move', targetId: 'chart_room' },
  { clientActionId: '3', type: 'investigate', targetId: 'chart_room' }, // draft map clue
  { clientActionId: '4', type: 'move', targetId: 'crow_nest' }, // should unlock after ink smudge discovered
]

for (const action of actions) {
  const r = resolveTurn(state, action)
  state = r.state
  log(state, `action ${action.type} -> ${action.targetId ?? ''}`)
}

// investigate crow nest for night log clue
{
  const r = resolveTurn(state, { clientActionId: '5', type: 'investigate', targetId: 'crow_nest' })
  state = r.state
  log(state, 'investigate crow_nest (night log)')
}

// talk to witness to build trust
for (let i = 0; i < 3; i++) {
  const r = resolveTurn(state, { clientActionId: `talk_witness_${i}`, type: 'talk', targetId: 'witness' })
  state = r.state
}
log(state, 'after talking to witness x3 (trust build)')

// use combined proof
{
  const r = resolveTurn(state, { clientActionId: 'use1', type: 'use', targetId: 'clue_combined_proof' })
  state = r.state
  log(state, 'use combined proof')
}

// go to captain room, talk to captain to trigger truth worldline event
for (let i = 0; i < 2; i++) {
  const r = resolveTurn(state, { clientActionId: `move_captain_${i}`, type: 'move', targetId: 'captain_room' })
  state = r.state
}
for (let i = 0; i < 5 && state.activeWorldline === 'undetermined'; i++) {
  const r = resolveTurn(state, { clientActionId: `talk_captain_${i}`, type: 'talk', targetId: 'captain' })
  state = r.state
  log(state, `talk captain attempt ${i}`)
}

console.log('\n\nFINAL WORLDLINE:', state.activeWorldline)
console.log('FINAL STABILITY:', state.cityStability)
console.log('FLAGS:', state.flags)

// test free text interpreter
const freeAction = interpretFreeText('我先不去车站，绕到后巷观察一下', state)
console.log('\nfree text interpretation:', freeAction)
const freeAction2 = interpretFreeText('去瞭望台找阿灯谈谈', createInitialWorldState())
console.log('free text interpretation2:', freeAction2)

console.log('\nSMOKE TEST DONE - worldline reached:', state.activeWorldline !== 'undetermined' ? 'YES' : 'NO (need more turns/different path)')
