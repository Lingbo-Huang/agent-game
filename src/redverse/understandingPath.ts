import type { WorldState } from './types'
import type { CompiledWorld } from './worldCompiler'

export interface UnderstandingPathNode {
  kind: 'source' | 'action' | 'agent' | 'evidence' | 'transfer'
  label: string
  title: string
  detail: string
}

function actionLabel(key: string, world: CompiledWorld): string {
  const [type, target] = key.split(':')
  if (type === 'talk') {
    const names = { partner: world.lexicon.partnerName, witness: world.lexicon.witnessName, captain: world.lexicon.captainName }
    return `与${names[target as keyof typeof names] ?? '角色'}交谈`
  }
  if (type === 'move') return `前往${world.locationCopy[target as keyof typeof world.locationCopy]?.shortName ?? '新地点'}`
  if (type === 'investigate') return '核对一条具体信息'
  if (type === 'observe') return '先观察，不急着判断'
  if (type === 'use') return '连接两份独立线索'
  return '为未知留出一点时间'
}

function concise(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`
}

export function buildUnderstandingPath(source: string, state: WorldState, world: CompiledWorld): UnderstandingPathNode[] {
  const actions = state.recentActionKeys.slice(-2).map((key) => actionLabel(key, world))
  const actors = state.lastCharacterActions.map((action) => `${world.agentBriefs?.[action.npcId]?.name ?? world.lexicon[`${action.npcId}Name`]}：${action.intent}`)
  const evidence = (Object.entries(state.clues) as Array<[keyof typeof state.clues, string]>)
    .filter(([, status]) => status === 'discovered' || status === 'connected' || status === 'resolved')
    .slice(-2)
    .map(([id]) => world.clueCopy[id].name)
  return [
    { kind: 'source', label: '现实起点', title: concise(source, 34), detail: '这是你的自述，不自动等于对他人动机的定论。' },
    { kind: 'action', label: '你的选择', title: actions.join(' → ') || '还没有行动', detail: '每个选择都会写入世界状态，而不是只换一段文案。' },
    { kind: 'agent', label: '角色立场', title: actors.join('；') || '角色正在按各自原则观察', detail: '人格原则不变；情绪、信任与策略会随事实变化。' },
    { kind: 'evidence', label: '新增理解', title: evidence.length ? evidence.join(' + ') : '目前仍缺少可复核信息', detail: `${evidence.length} 条信息可以使用；未知仍被明确保留。` },
    { kind: 'transfer', label: '带回现实', title: '一个低风险、可退出的小行动已经形成', detail: '具体行动见下方回响卡；不替你做高风险决定。' },
  ]
}
