// ============================================================
// REDVERSE MVP — 《灯塔城的航行日志》
// 最小但完整的「世界状态 + 自由探索 + 线索图 + 事件引擎 + 世界线」数据模型
// 参考: REDVERSE-产品设计逻辑与明日MVP.md 第 16 节「最小数据模型」
// ============================================================

export type ActionType = 'move' | 'observe' | 'investigate' | 'talk' | 'use' | 'wait'

export type LocationId = 'deck' | 'chart_room' | 'crow_nest' | 'captain_room'
export type NpcId = 'partner' | 'witness' | 'captain'
export type ClueId =
  | 'clue_draft_map' // 直接发现
  | 'clue_ink_smudge' // 直接发现
  | 'clue_night_log' // 直接发现（需先解锁瞭望台）
  | 'clue_witness_trust' // 通过人物关系获得
  | 'clue_captain_doubt' // 通过人物关系获得
  | 'clue_combined_proof' // 组合线索

export type WorldlineId = 'undetermined' | 'truth' | 'forgetting'

export type ClueStatus = 'hidden' | 'hinted' | 'discovered' | 'connected' | 'resolved' | 'disproved'

export interface ClueDef {
  id: ClueId
  name: string
  shortHint: string
  description: string
  originLocationId: LocationId
  relatedNpcIds: NpcId[]
  reliability: number // 0-1
  revealsText: string
  /** 需要哪些线索已 discovered 才能解锁本线索（组合线索用） */
  requiresClueIds?: ClueId[]
  /** 需要哪个 NPC 信任达到多少才能解锁（关系线索用） */
  requiresTrust?: { npc: NpcId; min: number }
}

export interface NpcDef {
  id: NpcId
  name: string
  role: string
  /** 不可被玩家说服改变的固定原则，用于演示"人格即规则" */
  immutablePrinciples: string[]
  /** 长期驱动力不会被单次对话改写，是角色自主决策的第二根锚。 */
  motivations: string[]
  /** 角色会主动规避的代价，用于产生不同于玩家意愿的行为。 */
  fears: string[]
  speechStyle: string[]
  portraitSymbol: string
}

export type CharacterActionKind = 'stay' | 'relocate' | 'observe' | 'disclose' | 'withdraw' | 'review'

/**
 * 角色 Agent 的可审计输出。模型将来也只能提出这个结构，
 * 世界引擎验证后才能真正修改位置、记忆和关系。
 */
export interface CharacterAction {
  npcId: NpcId
  kind: CharacterActionKind
  intent: string
  reason: string
  fromLocationId: LocationId
  toLocationId?: LocationId
  publicText: string
  performance: {
    emotion: NpcState['emotion']
    pose: 'still' | 'turn' | 'approach' | 'leave' | 'write' | 'inspect'
    emphasis: 'quiet' | 'normal' | 'strong'
  }
}

export interface NpcState {
  npcId: NpcId
  currentLocationId: LocationId
  trust: number // 0-100，玩家与该角色的信任度
  attitude: 'wary' | 'neutral' | 'warm' | 'defensive' | 'respect'
  knownFacts: string[]
  currentGoal: string
  emotion: 'calm' | 'uneasy' | 'guarded' | 'curious' | 'determined'
  recentMemories: string[]
  lastAction?: CharacterAction
  hasMetPlayer: boolean
}

export interface LocationDef {
  id: LocationId
  name: string
  shortName: string
  description: string
  ambientHintOpen: string
  /** 初始是否开放 */
  initiallyOpen: boolean
  /** 解锁条件描述（仅用于展示） */
  unlockHint?: string
  /** 解锁条件（程序判断） */
  unlockCondition?: (state: WorldState) => boolean
  travelMinutes: number
  /** 该地点上可发现的直接线索 */
  discoverableClueIds: ClueId[]
  residentNpcIds: NpcId[]
  /** 地图上的坐标（百分比，供简易地图渲染） */
  x: number
  y: number
}

export interface EventTemplate {
  id: string
  title: string
  category: 'environment' | 'character' | 'worldline'
  /** 触发所需地点，留空表示任意地点 */
  locationIds?: LocationId[]
  /** 触发所需已发现线索 */
  requiredClueIds?: ClueId[]
  /** 触发所需排除的 flag（已发生过某世界线事件后不再触发） */
  excludedFlags?: string[]
  requiredFlags?: string[]
  /** 额外的硬性条件（例如“回合数达到阈值”），不满足则该事件完全不进入候选池 */
  customCondition?: (state: WorldState) => boolean
  baseWeight: number
  cooldownTurns: number
  narrationTemplate: string
  effects: (state: WorldState) => Partial<WorldState> & { flagsPatch?: Record<string, boolean | number | string> }
}

export interface WorldState {
  worldId: string
  currentTurn: number
  currentTimeLabel: string // 展示用，如 "第一夜 21:40"
  weather: 'clear' | 'rain' | 'fog'
  playerLocationId: LocationId
  discoveredLocationIds: LocationId[]
  clues: Record<ClueId, ClueStatus>
  npcStates: Record<NpcId, NpcState>
  triggeredEventIds: string[]
  lastEventTurnByCategory: Record<string, number>
  flags: Record<string, boolean | number | string>
  cityStability: number // 借用文档命名，这里代表"真相稳定度/局势可控度"
  activeWorldline: WorldlineId
  log: TurnLogEntry[]
  /** 同一行动在同一对象上的累计次数，用来让世界拒绝原样复读。 */
  actionCounts: Record<string, number>
  /** 最近行动用于生成有上下文的下一组选项。 */
  recentActionKeys: string[]
  /** 已提交的客户端行动 ID。刷新恢复或网络重试时，相同 ID 只结算一次。 */
  processedActionIds: string[]
  /** 最近一轮经世界规则批准的角色自主行动。 */
  lastCharacterActions: CharacterAction[]
}

export interface TurnLogEntry {
  turn: number
  timeLabel: string
  kind: 'narration' | 'event' | 'system'
  text: string
}

export interface PlayerAction {
  clientActionId: string
  type: ActionType
  targetId?: string
  freeText?: string
}

export interface TurnResult {
  narration: string
  triggeredEvent?: EventTemplate
  discoveredClueIds: ClueId[]
  unlockedLocationIds: LocationId[]
  worldlineChanged: boolean
  characterActions: CharacterAction[]
}

export interface QuickAction {
  id: string
  type: ActionType
  targetId?: string
  label: string
  hint: string
  icon: string
  tone?: 'normal' | 'important'
}
