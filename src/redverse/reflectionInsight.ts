import type { WorldState } from './types'
import type { CompiledWorld } from './worldCompiler'

export interface ReflectionOption {
  title: string
  upside: string
  cost: string
  bestWhen: string
}

export interface ReflectionInsight {
  acknowledgement: string
  coreTension: string
  assessment: string
  knownFacts: string[]
  unknowns: string[]
  options: ReflectionOption[]
  nextStep: {
    title: string
    steps: string[]
    script: string
    successSignal: string
    stopCondition: string
  }
  source: 'personalized' | 'local'
}

function has(source: string, pattern: RegExp) { return pattern.test(source) }
function quotedSource(source: string) {
  const clean = source.replace(/\s+/g, ' ').trim()
  return clean.length > 72 ? `${clean.slice(0, 70)}…` : clean
}

interface SituationAnchors {
  counterpart: string
  timing?: string
  place?: string
  concreteSource: string
}

/**
 * 离线兜底只抽取用户明确写出的锚点，不猜测动机。
 * 在线模型会做更完整的语义分析；断网时仍要让用户看见自己的具体处境，
 * 而不是落回“多沟通、做小实验”一类万能话术。
 */
function extractSituationAnchors(source: string): SituationAnchors {
  const counterpartMatch = source.match(/(?:同事|老板|领导|合伙人|客户|伴侣|男友|女友|丈夫|妻子|父母|妈妈|爸爸|家人|孩子|老师|导师|学生|朋友|室友|学校|公司|团队)/)
  const timingMatch = source.match(/(?:今天|明天|后天|下周|下个月|月底|年底|秋招|校招|毕业前|\d+\s*(?:天|周|个月|年)(?:内|后|前)?)/)
  const placeMatch = source.match(/(?:北京|上海|广州|深圳|南京|杭州|成都|武汉|学校|公司|家里|异地|外地)/)
  return {
    counterpart: counterpartMatch?.[0] || '相关的人',
    timing: timingMatch?.[0],
    place: placeMatch?.[0],
    concreteSource: quotedSource(source),
  }
}

function academicInternshipInsight(source: string): ReflectionInsight {
  const teacher = has(source, /我是(?:老师|导师)|作为(?:老师|导师)|我的学生|我带的学生|我不让学生/)
  const speaker = teacher ? '你不是单纯在“拦着学生”' : '你不是单纯在“要不要实习”之间摇摆'
  const studentAcknowledgement = has(source, /随叫随到|返校|飞回|深圳|南京/)
    ? '你一边担心错过秋招前难得的实践机会，一边又被随叫随到、异地返校的要求牵制；甚至要为一次返校承担跨城时间和费用。你会怀疑老师是不理解就业现实，还是把学生当成随时可调用的资源，这种愤怒和无力感有现实来源。但仅凭这些行为，还不能替老师确定动机。'
    : '你一边怕错过秋招前难得的实践机会，一边又担心老师的反对会影响培养、毕业或师生关系。决定权似乎不完全在你手里，但错过招聘窗口的代价主要由你承担，这种焦虑和憋屈有现实来源。'
  return {
    acknowledgement: teacher ? `${speaker}。你一边怕学生错过秋招前难得的实践机会，一边又担心异地适应、岗位质量和准备不足；如果你承担指导责任，这份焦虑也来自“放手后出了问题怎么办”。这种矛盾不是冷漠，而是机会与保护责任同时存在。` : studentAcknowledgement,
    coreTension: teacher
      ? '真正要决定的不是“准不准去”，而是：这份实习能否带来足够的秋招收益，以及风险能否通过条件、期限和退出机制降到可接受。'
      : '真正的问题不是先猜老师“脱离社会”还是“把学生当资产”，而是：限制实习和临时返校的依据是什么、学生承担了什么就业与跨城成本、哪些培养责任必须线下完成，以及学生有没有明确的协商和申诉路径。',
    assessment: teacher
      ? '目前没有足够信息支持无条件放行，也没有足够信息支持直接禁止。更稳妥的判断方式是把态度争论改成准入条件：岗位价值、工作内容、带教、住宿与安全、时间冲突、学生意愿、学校规则、退出方案。'
      : '老师的真实动机目前无法确认，但“要求是否有书面依据、返校是否必要、通知是否合理、成本如何承担、是否存在远程替代”都可以核对。先把人格判断改写成规则与条件问题，既不会否认你的不满，也更容易获得可执行的答复。',
    knownFacts: [
      '秋招临近，实践经历可能影响简历竞争力和求职叙事。',
      '提出的机会需要离开当前环境，适应成本与管理风险真实存在。',
      teacher ? '你对学生的准备程度和长期发展负有一定指导责任。' : '老师当前的要求正在影响你安排实习、秋招准备或异地生活。',
    ],
    unknowns: [
      '岗位是否有真实项目、明确带教和可写进简历的成果，而不只是“有一段实习”。',
      '住宿、通勤、城市支持、工作强度和紧急联系人是否已落实。',
      '实习与秋招准备、课程或课题要求是否冲突，学校或导师有哪些正式规则。',
      teacher ? '学生本人理解了哪些风险，是否有能力求助和及时退出。' : '限制来自培养方案、院系制度、课题交付，还是老师个人的管理偏好；临时返校是否有必要性和合理提前量。',
    ],
    options: [
      ...(teacher ? [
        { title: '附条件支持这份实习', upside: '保留秋招机会，也把担心变成可以逐项验证的条件。', cost: '需要在出发前花时间核验岗位、生活与退出安排。', bestWhen: '岗位价值明确，关键风险有人负责，且不违反正式规则。' },
        { title: '先补材料，再决定', upside: '避免情绪对抗；双方围绕同一份信息做判断。', cost: '可能压缩入职窗口，需要给出明确答复期限。', bestWhen: '机会可能不错，但岗位、住宿、带教或时间线信息不完整。' },
        { title: '不去，但提供等价替代', upside: '降低异地风险，同时不让学生在秋招前空手。', cost: '校内项目未必具有同等行业信号，需要真实交付和外部反馈。', bestWhen: '岗位质量差、规则冲突或基本安全条件无法满足。' },
      ] : [
        { title: '先把规则查清', upside: '把“老师说了算”变成可核对的培养、出勤和实习边界。', cost: '暂时不能解决情绪，也可能发现确有硬性要求。', bestWhen: '对方只说“不允许”或“随时回来”，却没有给出具体依据。' },
        { title: '带条件方案去协商', upside: '保留实习和秋招机会，同时回应项目交付与返校需求。', cost: '需要准备时间线、远程交付和必要返校条件，也可能被拒绝。', bestWhen: '实习价值明确，且多数培养责任可以用固定交付或提前通知完成。' },
        { title: '做规则咨询而非控诉', upside: '让辅导员、研究生秘书或院系负责人澄清权限与申诉路径。', cost: '可能增加关系压力，材料和措辞必须克制、基于事实。', bestWhen: '多次沟通仍没有依据，临时跨城返校已造成明显就业、费用或毕业安排损失。' },
      ]),
    ],
    nextStep: {
      title: teacher ? '用一页“实习准入表”代替一句允许或不允许' : '用一页“实习—培养协调表”换一个具体答复',
      steps: teacher
        ? ['请学生写清岗位职责、预期成果、带教人和实习期限。', '补齐住宿通勤、工作强度、紧急联系人、学校规则和退出方式。', '约 20 分钟逐项讨论：哪些已确认，哪些还需要向公司或学校核实。', '约定一个答复时间；条件达标就支持，关键条件不达标就说明具体原因与替代方案。']
        : ['查培养方案、院系实习与出勤规定，标出原文和负责咨询的人。', '在一页纸写清实习与秋招日期、课程/科研交付、可固定到校时间、紧急返校的提前量与远程替代。', '约老师 20 分钟，只问三个问题：依据是什么、最担心什么、满足哪些条件可以同意。', '会后用文字确认结论；仍无具体依据时，拿同一页材料向辅导员或研究生秘书做规则咨询。'],
      script: teacher
        ? '“我不是想替你放弃机会。我担心的是岗位价值和异地风险现在还没被说清。我们用同一张表核对：如果带教、成果、住宿、时间冲突和退出方案都能落实，我愿意支持；如果有关键项过不了，我们一起找不耽误秋招的替代方案。”'
        : '“老师，我理解您担心实习影响培养或项目。我也担心错过秋招窗口，以及临时跨城返校的成本。请问限制实习和返校要求依据哪条规定？您最担心的具体风险是什么？如果我保证每周交付、关键节点提前到校，并约定紧急情况的远程方案，达到哪些条件您会愿意重新考虑？”',
      successSignal: '谈完后，双方能明确说出依据、必须完成的线下责任、可接受条件、返校提前量和答复时间，而不是只重复“不能去”。',
      stopCondition: teacher ? '若岗位拒绝说明职责与带教、生活安全没有基本安排、违反正式规则，或学生本人明显不愿意，应暂停推进并找学校或可信任第三方核实。' : '若对方持续拒绝说明依据、要求造成明显就业或跨城成本，或出现毕业与评价方面的威胁，不要继续单独争辩；保存通知和时间线，向辅导员、研究生秘书或院系负责人咨询正式规则。',
    },
    source: 'local',
  }
}

function generalInsight(source: string, world: CompiledWorld): ReflectionInsight {
  const focus = world.conflictFocus
  const anchors = extractSituationAnchors(source)
  const explicitConstraints = [anchors.timing, anchors.place].filter(Boolean).join('、')
  const isRelationship = world.themeId === 'relationship'
  const isWork = world.themeId === 'workplace'
  const isGrowth = world.themeId === 'growth'
  const acknowledgement = isRelationship
    ? `你提到“${anchors.concreteSource}”。难受的不只是一次分歧，还有“我在乎的东西有没有被${anchors.counterpart}看见”。既想保护关系，又不想继续委屈自己，这两种需要同时存在很正常。`
    : isWork
      ? `你提到“${anchors.concreteSource}”。你在意的不只是结果，还有自己的投入是否被${anchors.counterpart}公平看见。直接指出可能伤害关系，沉默又像默认接受；你同时在保护公平、关系和后续合作。`
      : isGrowth
        ? `你提到“${anchors.concreteSource}”。这件事让你开始怀疑自己，但一次结果通常混合了能力、方法、反馈和环境。你想变好，又怕下一次尝试再次受挫，这种拉扯值得被认真对待。`
        : `你提到“${anchors.concreteSource}”。你不是缺少一个“正确答案”，而是几个重要目标互相冲突：想抓住机会，也想避免后悔；想向前走，也不想承担无法退出的代价。`
  return {
    acknowledgement,
    coreTension: `${focus}不只是一道二选一题。你要保护自己的目标，也要判断${anchors.counterpart}的边界；${explicitConstraints ? `同时，“${explicitConstraints}”让时间或环境成本变得具体。` : '同时还要避免把尚未核对的担心当成必然结果。'}`,
    assessment: `目前只能确认你报告的处境，不能据此断定${anchors.counterpart}的动机。更有用的下一步，是先核对一个真正会改变决定的信息，再比较推进、附条件尝试和暂缓三条路各自的代价。`,
    knownFacts: [`你明确报告了：“${anchors.concreteSource}”。`, `这件事涉及${anchors.counterpart}，并影响你对${focus}的判断。`, ...(explicitConstraints ? [`你明确提到了“${explicitConstraints}”这一现实约束。`] : [])],
    unknowns: [`${anchors.counterpart}真正想保护的目标、依据和可接受条件，还没有被直接核对。`, '你最担心的后果发生概率、可补救程度和时间窗口仍不明确。', '是否存在比“马上做／完全不做”更小的中间选项。'],
    options: [
      { title: `直接向${anchors.counterpart}提出核心诉求`, upside: '最快让问题进入台面，避免继续消耗。', cost: '信息不足时容易让对方防御，也可能过早锁死方案。', bestWhen: `${explicitConstraints ? `${explicitConstraints}带来的窗口很短` : '事实已经清楚、时间窗口很短'}，而且你能承受对方拒绝。` },
      { title: `先向${anchors.counterpart}核对一个决定性未知`, upside: '用小成本换真实信息，减少凭想象做决定。', cost: '不能马上获得确定感，需要容忍短暂未知。', bestWhen: `你最纠结的部分取决于${anchors.counterpart}的意愿、规则或一个未确认条件。` },
      { title: '暂缓决定，但写清重启时间', upside: '给情绪和信息留空间，同时避免无限拖延。', cost: '可能错过部分窗口，必须明确何时重启决定。', bestWhen: `当前不适合与${anchors.counterpart}沟通，但短期内仍有补信息的可能。` },
    ],
    nextStep: {
      title: `和${anchors.counterpart}做一次只解决一个问题的短对话`,
      steps: [`把“${anchors.concreteSource}”拆成两项你亲自确认的事实，不写动机。`, `圈出一个只有${anchors.counterpart}、正式规则或具体记录才能回答的问题。`, `约${anchors.counterpart}进行 15–20 分钟对话，只核对这一项。`, '对话后再决定推进、附条件试行还是暂停，并写下退出条件。'],
      script: `“关于${focus}，我现在能确认的是……。我最担心的是……，但这部分我还没有证据。我想先和你确认一个问题：……。确认后我们再决定下一步，不需要一次说完。”`,
      successSignal: '你获得了一个之前没有的具体事实，或确认了对方明确的边界，而不是只重复各自立场。',
      stopCondition: '若对话出现威胁、羞辱、明显权力风险或你无法安全退出，停止自行推进，保存必要记录并寻求可信任第三方支持。',
    },
    source: 'local',
  }
}

export function buildLocalReflectionInsight(source: string, _state: WorldState, world: CompiledWorld): ReflectionInsight {
  if (has(source, /实习|秋招|校招/) && has(source, /老师|导师|学生|学校|工作|机会/)) return academicInternshipInsight(source)
  return generalInsight(source, world)
}

function validString(value: unknown, max = 500): value is string { return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= max }

export function parseReflectionInsight(value: unknown): ReflectionInsight | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const options = data.options
  const next = data.nextStep as Record<string, unknown> | undefined
  if (!validString(data.acknowledgement) || !validString(data.coreTension) || !validString(data.assessment) ||
    !Array.isArray(data.knownFacts) || !data.knownFacts.every((item) => validString(item, 240)) ||
    !Array.isArray(data.unknowns) || !data.unknowns.every((item) => validString(item, 240)) ||
    !Array.isArray(options) || options.length < 2 || options.length > 4 || !next) return null
  const parsedOptions = options as Array<Record<string, unknown>>
  if (!parsedOptions.every((item) => validString(item.title, 80) && validString(item.upside, 240) && validString(item.cost, 240) && validString(item.bestWhen, 240)) ||
    !validString(next.title, 120) || !Array.isArray(next.steps) || !next.steps.every((item) => validString(item, 240)) ||
    !validString(next.script, 600) || !validString(next.successSignal, 300) || !validString(next.stopCondition, 300)) return null
  return { ...(data as unknown as ReflectionInsight), source: 'personalized' }
}

export async function requestReflectionInsight(source: string, state: WorldState, world: CompiledWorld): Promise<ReflectionInsight | null> {
  const actions = state.recentActionKeys.slice(-5)
  const evidence = Object.entries(state.clues).filter(([, status]) => ['discovered', 'connected', 'resolved'].includes(status)).map(([id]) => world.clueCopy[id as keyof typeof world.clueCopy].name).slice(0, 6)
  try {
    const response = await fetch('/api/reflection-insight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, themeId: world.themeId, conflictFocus: world.conflictFocus, actions, evidence }) })
    if (!response.ok) return null
    return parseReflectionInsight(await response.json())
  } catch { return null }
}
