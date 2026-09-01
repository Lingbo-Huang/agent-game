import type {
  ClueDef,
  ClueId,
  EventTemplate,
  LocationDef,
  LocationId,
  NpcDef,
  NpcId,
  WorldState,
} from './types'

// ============================================================
// 世界：灯塔城的航行日志
// 玩家扮演制图员。三天前和搭档共同绘制出了新航线图，
// 但庆典上搭档独自领取了航海勋章，只字未提玩家的贡献。
// 这是"个人反思游戏"文档里职场功劳纠纷的镜像世界化版本，
// 叠加 REDVERSE 的自由探索地图 + 线索图 + 事件引擎 + 世界线机制。
// ============================================================

export const WORLD_TITLE = '灯塔城的航行日志'
export const WORLD_OPENING =
  '庆典的钟声还没停。你站在人群边缘，看着那枚本该属于两个人的航海勋章，被别在了别人的领口上。' +
  '甲板上的灯还亮着，制图室的门虚掩着——今晚，你可以选择去哪里，做什么。'

export const npcs: Record<NpcId, NpcDef> = {
  partner: {
    id: 'partner',
    name: '沈亦舟',
    role: '与你共同绘制航线图的搭档',
    immutablePrinciples: ['从不当众承认功劳有争议', '在乎自己在船员中的名声，胜过在乎事实本身'],
    motivations: ['守住自己来之不易的声望', '避免成为全船公开议论的对象'],
    fears: ['当众失去体面', '被证据逼到只能认错'],
    speechStyle: ['回避直接承认', '先谈集体利益，再谈个人责任'],
    portraitSymbol: '⛵',
  },
  witness: {
    id: 'witness',
    name: '阿灯',
    role: '值夜的水手，见过部分绘图过程',
    immutablePrinciples: ['不会证明自己没有亲眼看到的事', '能私下说的事，绝不在公开场合说'],
    motivations: ['让记录保持可信', '保护自己不被卷进派系争端'],
    fears: ['猜测被当成证词', '公开站队后失去中立'],
    speechStyle: ['只描述亲眼所见', '句子短，主动标明不知道什么'],
    portraitSymbol: '🏮',
  },
  captain: {
    id: 'captain',
    name: '祝舰长',
    role: '这艘船的舰长',
    immutablePrinciples: ['只根据证据做判断，不理会情绪化的指控', '对每一位船员一视同仁，不因交情徇私'],
    motivations: ['维持可复核的船上秩序', '让责任与荣誉都有依据'],
    fears: ['用同情代替程序', '仓促裁决破坏长期信任'],
    speechStyle: ['先复述标准', '给出下一步可执行的核实方法'],
    portraitSymbol: '⚓',
  },
}

export const locations: LocationDef[] = [
  {
    id: 'deck',
    name: '庆典甲板',
    shortName: '甲板',
    description:
      '庆典的灯笼还没撤下。海风里还留着方才喧闹的余温，甲板一角散落着几份没来得及收走的航线草图。',
    ambientHintOpen: '沈亦舟似乎还留在人群边缘，没有立刻离开。',
    initiallyOpen: true,
    travelMinutes: 5,
    discoverableClueIds: ['clue_ink_smudge'],
    residentNpcIds: ['partner'],
    x: 50,
    y: 78,
  },
  {
    id: 'chart_room',
    name: '制图室',
    shortName: '制图室',
    description:
      '墙上钉满了你们两人这三个月画的草稿。桌上还摊着最后一版航线图的底稿，边角被反复摩挲得发毛。',
    ambientHintOpen: '这里安静得能听到钟摆的声音。',
    initiallyOpen: true,
    travelMinutes: 4,
    discoverableClueIds: ['clue_draft_map'],
    residentNpcIds: [],
    x: 20,
    y: 40,
  },
  {
    id: 'captain_room',
    name: '舰长室',
    shortName: '舰长室',
    description:
      '祝舰长的桌上放着这次航行的全部记录副本。她抬头看了你一眼，没有说话，等你先开口。',
    ambientHintOpen: '舰长室的灯还亮着，说明她还没休息。',
    initiallyOpen: true,
    travelMinutes: 6,
    discoverableClueIds: [],
    residentNpcIds: ['captain'],
    x: 78,
    y: 30,
  },
  {
    id: 'crow_nest',
    name: '瞭望台',
    shortName: '瞭望台',
    description:
      '爬上瞭望台，值夜记录本还摊在老位置。风很大，值夜水手阿灯裹紧了外套，看到你有些意外。',
    ambientHintOpen: '瞭望台的梯子被重新放了下来。',
    initiallyOpen: false,
    unlockHint: '需要先在甲板上发现墨渍线索',
    unlockCondition: (state) => state.clues.clue_ink_smudge !== 'hidden',
    travelMinutes: 8,
    discoverableClueIds: ['clue_night_log'],
    residentNpcIds: ['witness'],
    x: 60,
    y: 12,
  },
]

export const clues: Record<ClueId, ClueDef> = {
  clue_draft_map: {
    id: 'clue_draft_map',
    name: '底稿上的两种笔迹',
    shortHint: '制图室 · 直接发现',
    description:
      '最后一版航线图的底稿上，关键的洋流修正是你的笔迹，署名却只有沈亦舟一人。底稿本身不会说谎。',
    originLocationId: 'chart_room',
    relatedNpcIds: ['partner'],
    reliability: 0.9,
    revealsText: '这张底稿证明了你参与了核心修正，而不只是"帮忙抄写"。',
  },
  clue_ink_smudge: {
    id: 'clue_ink_smudge',
    name: '袖口的墨渍',
    shortHint: '甲板 · 直接发现',
    description:
      '沈亦舟今晚的袖口有一道新鲜墨渍，和制图室里那种深蓝墨水一致——他昨晚很可能又去过制图室，独自补了什么。',
    originLocationId: 'deck',
    relatedNpcIds: ['partner'],
    reliability: 0.6,
    revealsText: '这道墨渍指向：昨晚深夜，制图室可能还有人去过。',
  },
  clue_night_log: {
    id: 'clue_night_log',
    name: '值夜记录本',
    shortHint: '瞭望台 · 直接发现（需先解锁）',
    description:
      '值夜记录本上写着："22:40，沈先生进入制图室，灯亮至凌晨。" 这是官方记录之外，唯一独立的时间证据。',
    originLocationId: 'crow_nest',
    relatedNpcIds: ['witness'],
    reliability: 0.85,
    revealsText: '独立记录证明了沈亦舟确实在深夜单独回到过制图室。',
  },
  clue_witness_trust: {
    id: 'clue_witness_trust',
    name: '阿灯没说全的那句话',
    shortHint: '与阿灯建立信任后获得',
    description:
      '阿灯犹豫了很久才说："我只能说我看到的部分，没办法替你证明全部——但我记得，那天他手里没有航线图。"',
    originLocationId: 'crow_nest',
    relatedNpcIds: ['witness'],
    reliability: 0.7,
    revealsText: '阿灯愿意作为有限但独立的旁证，但不会替你下结论。',
    requiresTrust: { npc: 'witness', min: 40 },
  },
  clue_captain_doubt: {
    id: 'clue_captain_doubt',
    name: '舰长的保留意见',
    shortHint: '与舰长建立信任后获得',
    description:
      '祝舰长承认："勋章仪式是按惯例走的流程，我当时也没有核实过贡献细节——如果你能拿出证据，我愿意重新看一次。"',
    originLocationId: 'captain_room',
    relatedNpcIds: ['captain'],
    reliability: 0.8,
    revealsText: '舰长的立场不是袒护，而是"没有证据前不会主动质疑"。',
    requiresTrust: { npc: 'captain', min: 40 },
  },
  clue_combined_proof: {
    id: 'clue_combined_proof',
    name: '完整的证据链',
    shortHint: '组合线索解锁',
    description:
      '底稿笔迹 + 独立的值夜记录，两条互不相关的证据指向同一个事实：你才是那处关键修正的作者。',
    originLocationId: 'chart_room',
    relatedNpcIds: ['partner', 'witness', 'captain'],
    reliability: 0.95,
    revealsText: '这不再是"你说他说"，而是一条可以摆在舰长桌上的证据链。',
    requiresClueIds: ['clue_draft_map', 'clue_night_log'],
  },
}

const initialNpcState = (npcId: NpcId, currentLocationId: LocationId): WorldState['npcStates'][NpcId] => ({
  npcId,
  currentLocationId,
  trust: 20,
  attitude: 'neutral',
  knownFacts: [],
  currentGoal: npcId === 'partner' ? '让庆典平稳结束，不公开讨论署名争议' : npcId === 'witness' ? '守好值夜记录，只对亲眼所见负责' : '在证据充分前维持程序中立',
  emotion: 'calm',
  recentMemories: [],
  hasMetPlayer: false,
})

export function createInitialWorldState(): WorldState {
  return {
    worldId: 'lighthouse_city_logbook',
    currentTurn: 0,
    currentTimeLabel: '庆典夜 · 21:40',
    weather: 'clear',
    playerLocationId: 'deck',
    discoveredLocationIds: ['deck', 'chart_room', 'captain_room'],
    clues: {
      clue_draft_map: 'hidden',
      clue_ink_smudge: 'hidden',
      clue_night_log: 'hidden',
      clue_witness_trust: 'hidden',
      clue_captain_doubt: 'hidden',
      clue_combined_proof: 'hidden',
    },
    npcStates: {
      partner: initialNpcState('partner', 'deck'),
      witness: initialNpcState('witness', 'crow_nest'),
      captain: initialNpcState('captain', 'captain_room'),
    },
    triggeredEventIds: [],
    lastEventTurnByCategory: {},
    flags: {
      confronted_partner: false,
      proof_presented: false,
      ending_reached: false,
    },
    cityStability: 60,
    activeWorldline: 'undetermined',
    actionCounts: {},
    recentActionKeys: [],
    processedActionIds: [],
    lastCharacterActions: [],
    log: [
      {
        turn: 0,
        timeLabel: '庆典夜 · 21:40',
        kind: 'system',
        text: WORLD_OPENING,
      },
    ],
  }
}

// ============================================================
// 事件模板：2 环境 + 2 人物 + 2 世界线
// ============================================================

export const eventTemplates: EventTemplate[] = [
  {
    id: 'event_fog',
    title: '海雾突然升起',
    category: 'environment',
    locationIds: ['deck', 'crow_nest'],
    baseWeight: 20,
    cooldownTurns: 3,
    narrationTemplate:
      '海雾毫无预兆地涌了上来，远处的灯塔光变得模糊。甲板上的人群开始散去，有人小声说"今晚看不清路了"。',
    effects: () => ({ weather: 'fog' }),
  },
  {
    id: 'event_bell',
    title: '换岗钟声',
    category: 'environment',
    baseWeight: 18,
    cooldownTurns: 4,
    narrationTemplate: '换岗的钟声响起。船上的人开始按各自的岗位走动，阿灯也提着灯笼往瞭望台去了。',
    effects: (state) => ({
      npcStates: {
        ...state.npcStates,
        witness: { ...state.npcStates.witness, currentLocationId: 'crow_nest' },
      },
    }),
  },
  {
    id: 'event_partner_approach',
    title: '沈亦舟主动开口',
    category: 'character',
    locationIds: ['deck'],
    requiredFlags: undefined,
    excludedFlags: ['confronted_partner'],
    baseWeight: 26,
    cooldownTurns: 99,
    narrationTemplate:
      '沈亦舟看到你，愣了一下，还是走了过来："今天的事……你要是有话想说，现在说也行。" 他的语气比平时更快，像是在抢先给自己找台阶。',
    effects: () => ({ flagsPatch: { confronted_partner: true } }),
  },
  {
    id: 'event_witness_night_visit',
    title: '阿灯深夜来找你',
    category: 'character',
    requiredClueIds: ['clue_ink_smudge'],
    excludedFlags: ['witness_night_visit_done'],
    baseWeight: 22,
    cooldownTurns: 99,
    narrationTemplate:
      '阿灯提着灯笼来找你，压低声音："我不想卷进你们的事，但那天晚上……我记得一些事，只是不确定该不该说。"',
    effects: (state) => ({
      npcStates: {
        ...state.npcStates,
        witness: { ...state.npcStates.witness, trust: Math.min(100, state.npcStates.witness.trust + 10) },
      },
      flagsPatch: { witness_night_visit_done: true },
    }),
  },
  {
    id: 'event_worldline_truth_push',
    title: '舰长要求当面说明',
    category: 'worldline',
    requiredClueIds: ['clue_combined_proof'],
    requiredFlags: ['ending_reached'],
    excludedFlags: ['worldline_pushed'],
    baseWeight: 30,
    cooldownTurns: 99,
    narrationTemplate:
      '祝舰长把证据链看了两遍，抬起头："如果这是真的，我会重新核实这次的记功。但从现在起，这件事就摆在明面上了，没有回头路。"',
    effects: () => ({
      activeWorldline: 'truth',
      cityStability: 75,
      flagsPatch: { worldline_pushed: true, proof_presented: true, ending_reached: true },
    }),
  },
  {
    id: 'event_worldline_forgetting_push',
    title: '庆典的喧闹渐渐散去',
    category: 'worldline',
    excludedFlags: ['worldline_pushed'],
    requiredFlags: ['accepted_forgetting'],
    // 第 12 回合后只显示压力分叉；玩家明确选择“接受翻篇”后才结算。
    customCondition: (state) => state.currentTurn >= 12,
    baseWeight: 12,
    cooldownTurns: 99,
    narrationTemplate:
      '庆典的灯笼一盏盏熄灭，甲板恢复了平常的样子。也许今晚发生的一切，很快就会被当作"没什么大不了的小事"，被大家默默翻篇。',
    effects: (state) => ({
      activeWorldline: 'forgetting',
      cityStability: state.cityStability - 15,
      // “什么都不做”同样会产生后果。将遗忘线正式结算为可回看的结局，
      // 避免玩家持续等待后只看到世界线变化，却永远等不到结局入口。
      flagsPatch: { worldline_pushed: true, ending_reached: true, ending_kind: 'forgetting' },
    }),
  },
]
