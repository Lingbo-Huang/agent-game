import { buildLocalRealWorldAnalysis, type RealWorldAnalysis } from './realWorldAnalysis'

export type WorldThemeId = 'workplace' | 'relationship' | 'decision' | 'growth'
export type WorldActorId = 'partner' | 'witness' | 'captain'

export interface WorldAgentBrief {
  name: string
  principle: string
  goal: string
}

export interface CompiledWorld {
  themeId: WorldThemeId
  worldTitle: string
  metaphor: string
  openingQuestion: string
  objectiveTitle: string
  objectiveDetail: string
  conflictFocus: string
  roleLabels: { partner: string; witness: string; captain: string }
  reflectionLens: string
  reversibleAction: string
  openingNarrative: string
  chapterTitles: [string, string, string, string]
  lexicon: {
    partnerName: string
    witnessName: string
    captainName: string
    artifact: string
    record: string
    process: string
    outcome: string
  }
  locationCopy: Record<'deck' | 'chart_room' | 'crow_nest' | 'captain_room', { name: string; shortName: string; description: string }>
  clueCopy: Record<'clue_draft_map' | 'clue_ink_smudge' | 'clue_night_log' | 'clue_witness_trust' | 'clue_captain_doubt' | 'clue_combined_proof', { name: string; meaning: string }>
  actionCopy: {
    observe: string
    investigate: string
    combine: string
    partnerTalk: [string, string, string]
    witnessTalk: [string, string, string]
    captainTalk: [string, string, string]
  }
  /** 角色人格在同一主题下也会按用户情境换装；原则仍由世界规则约束。 */
  agentBriefs?: Record<WorldActorId, WorldAgentBrief>
  /** 服务端 World Builder 是否成功完成了本局个性化。 */
  generated?: boolean
  /** 先回应现实问题，再把寓言世界作为可选推演工具。 */
  realWorldAnalysis: RealWorldAnalysis
}

export type WorldPersonalization = Pick<CompiledWorld,
  'worldTitle' | 'metaphor' | 'openingQuestion' | 'objectiveTitle' | 'objectiveDetail' |
  'conflictFocus' | 'reflectionLens' | 'reversibleAction' | 'openingNarrative' |
  'chapterTitles' | 'lexicon' | 'agentBriefs' | 'realWorldAnalysis' | 'locationCopy' |
  'clueCopy' | 'actionCopy'>

const profiles: Record<WorldThemeId, Omit<CompiledWorld, 'themeId' | 'realWorldAnalysis'>> = {
  workplace: {
    worldTitle: '灯塔城的航行日志',
    metaphor: '一枚只刻了一个名字的航海勋章',
    openingQuestion: '功劳、规则与关系发生冲突时，哪些事实能被第三方复核？',
    objectiveTitle: '把贡献感受变成可复核事实',
    objectiveDetail: '区分实际完成的工作、他人的表述和你尚不知道的动机。',
    conflictFocus: '贡献归属与公平流程',
    roleLabels: { partner: '共同绘图的搭档', witness: '只为亲眼所见负责的值夜员', captain: '只按证据启动复核的舰长' },
    reflectionLens: '你怎样在保护关系的同时，让自己的贡献进入公平流程？',
    reversibleAction: '先整理三条可验证的贡献记录，再约一次只谈事实和下次署名规则的私下沟通。',
    openingNarrative: '庆典的钟声还没停。你看着本该属于两个人的航海勋章，被别在了一个人的领口上。甲板上的灯还亮着，制图室的门虚掩着——今晚，你可以先听、先查，或者直接追问。',
    chapterTitles: ['被拿走的勋章', '感觉落到记录上', '不同的人只看见一部分', '让事实进入流程'],
    lexicon: { partnerName: '沈亦舟', witnessName: '阿灯', captainName: '祝舰长', artifact: '航线底稿', record: '值夜记录', process: '记功复核', outcome: '贡献归属' },
    locationCopy: {
      deck: { name: '庆典甲板', shortName: '甲板', description: '人群刚刚散开，勋章仍在灯下发亮，当事人还没有离开。' },
      chart_room: { name: '制图室', shortName: '制图室', description: '各版本底稿按时间叠放，修改笔迹和署名都能被核对。' },
      crow_nest: { name: '值夜瞭望台', shortName: '瞭望台', description: '值夜员保存着独立时间记录，但他只愿为亲眼所见负责。' },
      captain_room: { name: '舰长室', shortName: '舰长室', description: '这里不会因为谁更委屈就改变结论，只接受可复核的信息。' },
    },
    clueCopy: {
      clue_draft_map: { name: '底稿上的两种笔迹', meaning: '确认你参与了核心修改；不能单独说明对方是否故意隐瞒。' },
      clue_ink_smudge: { name: '袖口的新鲜墨渍', meaning: '提示昨夜可能有人返回制图室；不能证明他做了什么。' },
      clue_night_log: { name: '值夜时间记录', meaning: '确认进入制图室的时间；记录无法解释动机。' },
      clue_witness_trust: { name: '有限旁证', meaning: '证人只为亲眼所见负责，不替任何一方推测。' },
      clue_captain_doubt: { name: '可重开的流程', meaning: '说明记功可以复核；前提是材料达到标准。' },
      clue_combined_proof: { name: '贡献证据链', meaning: '两份独立记录互证，足以启动正式复核。' },
    },
    actionCopy: {
      observe: '留意搭档的反应', investigate: '检查异常细节', combine: '把两条线索拼成证据链',
      partnerTalk: ['私下问沈亦舟发生了什么', '只核对最后一版由谁修改', '指出他前后说法的边界'],
      witnessTalk: ['询问阿灯亲眼看见什么', '请阿灯只确认记录时间', '确认哪些部分他并不知道'],
      captainTalk: ['询问舰长需要什么证据', '只陈述可确认的贡献事实', '确认记功复核的标准'],
    },
  },
  relationship: {
    worldTitle: '双帆湾的潮汐约定',
    metaphor: '两艘想并肩、却总被不同潮汐拉开的船',
    openingQuestion: '关系里的冲突，来自不在乎，还是双方没有说清各自保护的东西？',
    objectiveTitle: '分开需要、边界与猜测',
    objectiveDetail: '听见双方真正想保护的东西，再寻找不用一次定终局的小试验。',
    conflictFocus: '亲密关系中的需要与边界',
    roleLabels: { partner: '与你同航但节奏不同的人', witness: '只描述具体互动的守潮人', captain: '帮助双方确认边界的港务官' },
    reflectionLens: '你真正希望对方理解的需要是什么，哪些边界不能靠猜？',
    reversibleAction: '用“我感受到 / 我需要 / 我愿意先试一周”的结构，提出一个有期限的小约定。',
    openingNarrative: '双帆湾的潮水把两艘船推得忽近忽远。你们都说想并肩，却在每次靠近时用不同的方式保护自己。今晚，旧约定被放在潮汐桌上；你可以先听、先核对，或提出一个新的边界。',
    chapterTitles: ['两艘不同步的船', '猜测背后的需要', '边界不是惩罚', '试一个小约定'],
    lexicon: { partnerName: '泊舟', witnessName: '潮汐员小澜', captainName: '港务官闻汐', artifact: '潮汐约定', record: '靠岸记录', process: '边界协商', outcome: '共同约定' },
    locationCopy: {
      deck: { name: '双帆泊位', shortName: '泊位', description: '两艘船停得很近，但谁都没有先把真正的需要说完整。' },
      chart_room: { name: '约定室', shortName: '约定室', description: '过去说过的话和实际发生的事被分开放着，方便核对。' },
      crow_nest: { name: '守潮塔', shortName: '守潮塔', description: '守潮人记录靠近与离开的时刻，却不知道每个人心里的原因。' },
      captain_room: { name: '边界码头', shortName: '码头', description: '双方可以在这里提出有期限、能退出的新约定。' },
    },
    clueCopy: {
      clue_draft_map: { name: '说过的约定', meaning: '确认双方曾怎样约定；不能证明彼此一直理解相同。' },
      clue_ink_smudge: { name: '没说完的停顿', meaning: '提示有人在保护某种需要；不能直接猜出原因。' },
      clue_night_log: { name: '靠近与离开记录', meaning: '确认互动发生的时间和频率；不能替任何人定义感受。' },
      clue_witness_trust: { name: '局外人的有限观察', meaning: '补充具体行为，不裁判谁更爱谁。' },
      clue_captain_doubt: { name: '可协商的边界', meaning: '说明关系规则能够重谈，但双方都要有退出权。' },
      clue_combined_proof: { name: '需要与边界图', meaning: '把行为、需要和猜测分开，足以发起一次清楚的对话。' },
    },
    actionCopy: {
      observe: '留意对方在保护什么', investigate: '核对过去的具体约定', combine: '把需要和边界放在一起',
      partnerTalk: ['问泊舟真正担心什么', '只核对一次具体冲突', '说清自己不愿退让的边界'],
      witnessTalk: ['问守潮人看见了什么', '只确认靠近与离开的时刻', '确认哪些感受她并不知道'],
      captainTalk: ['询问怎样提出新约定', '分别说出需要与边界', '设计一个可退出的小试验'],
    },
  },
  decision: {
    worldTitle: '岔航群岛的未寄罗盘',
    metaphor: '一枚同时指向两座岛的罗盘',
    openingQuestion: '没有完美信息时，怎样让选择可试、可退、可学习？',
    objectiveTitle: '把终局选择拆成可逆试验',
    objectiveDetail: '核对每条路的收益、代价和不可逆部分，避免用焦虑冒充事实。',
    conflictFocus: '不确定中的取舍与后悔',
    roleLabels: { partner: '催你立刻启航的同行者', witness: '保存过往航线记录的观察员', captain: '只批准边界清楚试航的领航员' },
    reflectionLens: '哪部分选择可以先试，哪部分一旦发生就很难回头？',
    reversibleAction: '写下最担心的三个代价，为其中一个方案设计一个七天、可退出的小规模试验。',
    openingNarrative: '岔航群岛的罗盘同时指向两座岛：一边是熟悉的港口，一边是尚未验证的新航线。催航的钟已经响了，但真正的问题不是“现在就选哪边”，而是哪些信息能先用一次小试航换回来。',
    chapterTitles: ['罗盘同时指向两边', '焦虑不是航海数据', '看见不可逆的礁石', '先做一次小试航'],
    lexicon: { partnerName: '洛岚', witnessName: '时雨', captainName: '试航官岚舟', artifact: '两条航线草案', record: '旧航程记录', process: '试航评估', outcome: '路线选择' },
    locationCopy: {
      deck: { name: '岔航码头', shortName: '码头', description: '两条航线都在招手，催促和担忧混在同一阵风里。' },
      chart_room: { name: '路线推演室', shortName: '推演室', description: '收益、代价、假设和不可逆条件被分别标在航图上。' },
      crow_nest: { name: '旧航程档案塔', shortName: '档案塔', description: '这里保存相似选择的真实记录，不保证你的未来会照样发生。' },
      captain_room: { name: '试航许可舱', shortName: '许可舱', description: '只有边界、期限和退出条件都清楚的试航才会获准。' },
    },
    clueCopy: {
      clue_draft_map: { name: '两条路线的真实条件', meaning: '确认目前已知收益与代价；不能预测所有未来。' },
      clue_ink_smudge: { name: '被焦虑放大的代价', meaning: '提示某个担忧需要验证；不代表它一定会发生。' },
      clue_night_log: { name: '相似试航记录', meaning: '提供历史参考；不能代替你的具体约束。' },
      clue_witness_trust: { name: '过来人的有限经验', meaning: '说明一种可能路径，不构成替你决定的答案。' },
      clue_captain_doubt: { name: '退出与止损条件', meaning: '说明哪些步骤可逆，哪些投入需要预先设边界。' },
      clue_combined_proof: { name: '七天试航方案', meaning: '把假设、期限和退出条件连起来，足以开始低风险验证。' },
    },
    actionCopy: {
      observe: '分开事实和最坏想象', investigate: '核对两条路线的真实代价', combine: '拼出一份可退出的试航方案',
      partnerTalk: ['问洛岚为什么催你启航', '只核对一种最担心的代价', '说清哪些风险你不能接受'],
      witnessTalk: ['询问时雨见过的相似航程', '请她只说真实发生的部分', '确认哪些结果并不适用于你'],
      captainTalk: ['询问试航需要什么条件', '提交期限与止损线', '确认怎样保留返回的可能'],
    },
  },
  growth: {
    worldTitle: '回声森林的未完成地图',
    metaphor: '一张总被“我不够好”擦掉的成长地图',
    openingQuestion: '眼前的挫败说明能力不足，还是只说明一种方法尚未奏效？',
    objectiveTitle: '把自我评价还原成一次具体事件',
    objectiveDetail: '寻找行动、反馈和环境证据，不让一次结果替整个人下结论。',
    conflictFocus: '自我怀疑与成长反馈',
    roleLabels: { partner: '急着证明自己的挑战者', witness: '记录具体变化的林中观察员', captain: '只评价方法与证据的守林人' },
    reflectionLens: '这次经历具体说明了哪种方法需要调整，而不是说明你是什么样的人？',
    reversibleAction: '选一个最小能力点，做一次二十分钟练习并只记录事实反馈，不给自己打总分。',
    openingNarrative: '回声森林里，一次不理想的结果被放大成“我就是不行”的回声，反复撞回耳边。守林人把那张被擦花的地图摊开：今天不评价整个人，只寻找一次行动、一次反馈和一种可调整的方法。',
    chapterTitles: ['回声替你下了结论', '把评价还原成事件', '找到具体反馈', '改一种方法再试'],
    lexicon: { partnerName: '跃跃', witnessName: '苔痕记录员', captainName: '守林人青岑', artifact: '练习地图', record: '反馈记录', process: '方法复盘', outcome: '下一次尝试' },
    locationCopy: {
      deck: { name: '回声林地', shortName: '林地', description: '“我不够好”的回声很响，但具体发生过什么还没有被说清。' },
      chart_room: { name: '练习工坊', shortName: '工坊', description: '每次行动和结果被分开记录，失败不再等于人格判决。' },
      crow_nest: { name: '苔痕观察台', shortName: '观察台', description: '细小变化会留下痕迹，记录员只描述变化，不给人打总分。' },
      captain_room: { name: '方法温室', shortName: '温室', description: '这里比较方法，不比较人的价值；下一次尝试可以很小。' },
    },
    clueCopy: {
      clue_draft_map: { name: '一次具体的尝试', meaning: '确认你做过什么；一次结果不能定义全部能力。' },
      clue_ink_smudge: { name: '卡住的那个步骤', meaning: '提示方法可能需要调整；不等于你没有能力。' },
      clue_night_log: { name: '可观察的变化记录', meaning: '确认练习中的细小变化；不能给整个人下结论。' },
      clue_witness_trust: { name: '具体反馈', meaning: '指出行为层面的变化，不使用“你就是”式标签。' },
      clue_captain_doubt: { name: '可替换的方法', meaning: '说明结果可以通过换策略继续验证。' },
      clue_combined_proof: { name: '下一次微练习', meaning: '把具体步骤与反馈连接起来，足以开始一次小尝试。' },
    },
    actionCopy: {
      observe: '听清回声在说什么', investigate: '把失败拆成具体步骤', combine: '拼出一次二十分钟微练习',
      partnerTalk: ['问跃跃为什么急着证明自己', '只复盘一个卡住的步骤', '停止给整个人下结论'],
      witnessTalk: ['询问记录员看见的变化', '请她只说具体反馈', '确认哪些评价没有证据'],
      captainTalk: ['询问怎样调整方法', '提出一个最小练习', '确认只记录事实反馈'],
    },
  },
}

const agentProfiles: Record<WorldThemeId, Record<WorldActorId, WorldAgentBrief>> = {
  workplace: {
    partner: { name: '沈亦舟', principle: '先保护公开名声，不会被一句质问立刻改写立场', goal: '避免公开冲突，同时守住自己的解释空间' },
    witness: { name: '阿灯', principle: '只为亲眼所见和书面记录负责', goal: '把观察与猜测严格分开' },
    captain: { name: '祝舰长', principle: '只按可复核信息启动正式流程', goal: '在证据充分前保持程序中立' },
  },
  relationship: {
    partner: { name: '泊舟', principle: '需要亲近，也会在感到被控制时保护自己的边界', goal: '说清自己害怕失去什么，而不是争输赢' },
    witness: { name: '潮汐员小澜', principle: '只描述具体互动，不裁判谁更爱谁', goal: '补上双方都忽略的情境信息' },
    captain: { name: '港务官闻汐', principle: '任何约定都要让双方能理解、能拒绝、能退出', goal: '帮助双方设计一个有期限的小约定' },
  },
  decision: {
    partner: { name: '洛岚', principle: '偏好行动和机会，但不能替玩家承担不可逆代价', goal: '推动一次真实试验，而不是无限空想' },
    witness: { name: '时雨', principle: '历史经验只能提供参考，不能冒充你的未来', goal: '区分相似案例与玩家自己的约束' },
    captain: { name: '试航官岚舟', principle: '只有期限、边界和退出条件清楚的试航才获准', goal: '把终局选择拆成可学习的小试航' },
  },
  growth: {
    partner: { name: '跃跃', principle: '渴望证明自己，但不能把一次结果等同于整个人', goal: '把笼统自责缩小成一个可练习的步骤' },
    witness: { name: '苔痕记录员', principle: '只记录可观察的变化，不给人贴永久标签', goal: '找出行动、反馈和环境中的具体变化' },
    captain: { name: '守林人青岑', principle: '评价方法而不评价人的价值', goal: '设计一次二十分钟、可复盘的微练习' },
  },
}

export function getWorldAgentBrief(world: CompiledWorld, actorId: WorldActorId): WorldAgentBrief {
  return world.agentBriefs?.[actorId] ?? agentProfiles[world.themeId][actorId]
}

const patterns: Array<{ id: WorldThemeId; strong: RegExp; context: RegExp }> = [
  { id: 'decision', strong: /要不要|是否应该|不知道.*(选|去|留)|选哪个|两份.*offer|两个.*机会|两种.*机会|稳定.*(冒险|成长)|冒险.*稳定|离职|转行|搬家|出国|读书|留下还是|选择|决定|犹豫|纠结/, context: /收入|机会|代价|后悔|风险|工作|学校|城市/ },
  { id: 'relationship', strong: /吵架|冷战|分手|被忽视|不理我|不理解我|边界|关系/, context: /朋友|伴侣|男友|女友|老公|老婆|父母|家人|约会|旅行/ },
  { id: 'workplace', strong: /抢.*功劳|功劳.*(自己|独占|抢走)|说成.*自己的|汇报.*(忽略|没提|说成)|绩效|升职|署名|职场|老板|领导|同事/, context: /项目|团队|工作|加班|贡献|功劳/ },
  { id: 'growth', strong: /失败|学不会|不够好|没自信|拖延|自责|能力不行|考试|成长|迷茫/, context: /焦虑|害怕|练习|反馈|努力/ },
]

export function classifyWorldTheme(source: string): WorldThemeId {
  const scored = patterns.map(({ id, strong, context }, index) => ({
    id,
    index,
    score: (source.match(new RegExp(strong.source, 'g')) || []).length * 4
      + (source.match(new RegExp(context.source, 'g')) || []).length,
  }))
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored[0].score > 0 ? scored[0].id : 'growth'
}

export function compileWorld(source: string): CompiledWorld {
  const themeId = classifyWorldTheme(source)
  return { themeId, ...profiles[themeId], realWorldAnalysis: buildLocalRealWorldAnalysis(source, themeId) }
}

function isNonEmpty(value: unknown, max = 180): value is string {
  return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= max
}

function isAgentBrief(value: unknown): value is WorldAgentBrief {
  if (!value || typeof value !== 'object') return false
  const brief = value as Record<string, unknown>
  return isNonEmpty(brief.name, 20) && isNonEmpty(brief.principle, 100) && isNonEmpty(brief.goal, 100)
}

function isRealWorldAnalysis(value: unknown): value is RealWorldAnalysis {
  if (!value || typeof value !== 'object') return false
  const analysis = value as Partial<RealWorldAnalysis>
  return isNonEmpty(analysis.situationSummary, 360) && isNonEmpty(analysis.emotionalAcknowledgement, 260) &&
    isNonEmpty(analysis.coreConflict, 360) && Array.isArray(analysis.knownFacts) && analysis.knownFacts.length === 2 &&
    analysis.knownFacts.every((item) => isNonEmpty(item, 180)) && Array.isArray(analysis.unknowns) &&
    analysis.unknowns.length === 2 && analysis.unknowns.every((item) => isNonEmpty(item, 220)) &&
    Array.isArray(analysis.options) && analysis.options.length === 3 && analysis.options.every((item) => isNonEmpty(item, 260)) &&
    isNonEmpty(analysis.firstAction, 360) && isNonEmpty(analysis.conversationScript, 420) &&
    isNonEmpty(analysis.escalationBoundary, 360)
}

/**
 * World Builder 只负责为已验证的规则骨架换装。返回值逐字段校验；任何越界、
 * 超时或网络失败都回落到本地世界，因此模型永远不是可通关性的单点故障。
 */
export async function personalizeWorld(source: string, fallback = compileWorld(source), timeoutMs = 72_000): Promise<CompiledWorld> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch('/api/world-spec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, themeId: fallback.themeId }),
      signal: controller.signal,
    })
    if (!response.ok) return fallback
    const value = await response.json() as Partial<WorldPersonalization>
    const chapters = value.chapterTitles
    const lexicon = value.lexicon
    const agents = value.agentBriefs
    const generatedLocations = value.locationCopy
    const generatedClues = value.clueCopy
    const generatedActions = value.actionCopy
    const analysis = isRealWorldAnalysis(value.realWorldAnalysis) ? value.realWorldAnalysis : fallback.realWorldAnalysis
    if (
      !isNonEmpty(value.worldTitle, 32) || !isNonEmpty(value.metaphor, 80) ||
      !isNonEmpty(value.openingQuestion, 100) || !isNonEmpty(value.objectiveTitle, 40) ||
      !isNonEmpty(value.objectiveDetail, 120) || !isNonEmpty(value.conflictFocus, 50) ||
      !isNonEmpty(value.reflectionLens, 120) || !isNonEmpty(value.reversibleAction, 160) ||
      !isNonEmpty(value.openingNarrative, 360) || !Array.isArray(chapters) || chapters.length !== 4 ||
      !chapters.every((item) => isNonEmpty(item, 30)) || !lexicon ||
      !isNonEmpty(lexicon.partnerName, 20) || !isNonEmpty(lexicon.witnessName, 20) ||
      !isNonEmpty(lexicon.captainName, 20) || !isNonEmpty(lexicon.artifact, 30) ||
      !isNonEmpty(lexicon.record, 30) || !isNonEmpty(lexicon.process, 30) ||
      !isNonEmpty(lexicon.outcome, 30) || !agents ||
      !isAgentBrief(agents.partner) || !isAgentBrief(agents.witness) || !isAgentBrief(agents.captain) ||
      !generatedLocations || !(['deck', 'chart_room', 'crow_nest', 'captain_room'] as const).every((id) =>
        isNonEmpty(generatedLocations[id]?.name, 30) && isNonEmpty(generatedLocations[id]?.shortName, 16) && isNonEmpty(generatedLocations[id]?.description, 120)) ||
      !generatedClues || !(['clue_draft_map', 'clue_ink_smudge', 'clue_night_log', 'clue_witness_trust', 'clue_captain_doubt', 'clue_combined_proof'] as const).every((id) =>
        isNonEmpty(generatedClues[id]?.name, 36) && isNonEmpty(generatedClues[id]?.meaning, 160)) ||
      !generatedActions || !isNonEmpty(generatedActions.observe, 180) || !isNonEmpty(generatedActions.investigate, 180) ||
      !isNonEmpty(generatedActions.combine, 180) || !Array.isArray(generatedActions.partnerTalk) || generatedActions.partnerTalk.length !== 3 ||
      !Array.isArray(generatedActions.witnessTalk) || generatedActions.witnessTalk.length !== 3 ||
      !Array.isArray(generatedActions.captainTalk) || generatedActions.captainTalk.length !== 3 ||
      ![...generatedActions.partnerTalk, ...generatedActions.witnessTalk, ...generatedActions.captainTalk].every((item) => isNonEmpty(item, 220))
    ) return fallback
    return {
      ...fallback,
      worldTitle: value.worldTitle.trim(), metaphor: value.metaphor.trim(),
      openingQuestion: value.openingQuestion.trim(), objectiveTitle: value.objectiveTitle.trim(),
      objectiveDetail: value.objectiveDetail.trim(), conflictFocus: value.conflictFocus.trim(),
      reflectionLens: value.reflectionLens.trim(), reversibleAction: value.reversibleAction.trim(),
      openingNarrative: value.openingNarrative.trim(),
      chapterTitles: chapters.map((item) => item.trim()) as CompiledWorld['chapterTitles'],
      lexicon: Object.fromEntries(Object.entries(lexicon).map(([key, item]) => [key, item.trim()])) as CompiledWorld['lexicon'],
      agentBriefs: {
        partner: { name: agents.partner.name.trim(), principle: agents.partner.principle.trim(), goal: agents.partner.goal.trim() },
        witness: { name: agents.witness.name.trim(), principle: agents.witness.principle.trim(), goal: agents.witness.goal.trim() },
        captain: { name: agents.captain.name.trim(), principle: agents.captain.principle.trim(), goal: agents.captain.goal.trim() },
      },
      realWorldAnalysis: analysis,
      locationCopy: generatedLocations,
      clueCopy: generatedClues,
      actionCopy: generatedActions,
      generated: true,
    }
  } catch {
    return fallback
  } finally {
    window.clearTimeout(timer)
  }
}
