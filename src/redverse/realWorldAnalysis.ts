import type { WorldThemeId } from './worldCompiler'

export interface RealWorldAnalysis {
  situationSummary: string
  emotionalAcknowledgement: string
  coreConflict: string
  knownFacts: [string, string]
  unknowns: [string, string]
  options: [string, string, string]
  firstAction: string
  conversationScript: string
  escalationBoundary: string
}

function educationInternshipAnalysis(): RealWorldAnalysis {
  return {
    situationSummary: '你面对的不是简单的“要不要实习”，而是三件事撞在了一起：老师希望你留校、秋招窗口不会等人、你又担心直接冲突会影响毕业与师生关系。',
    emotionalAcknowledgement: '着急、憋屈甚至有点无力都很正常。决定权似乎不完全在你手里，但错过招聘窗口的代价最后主要由你承担。',
    coreConflict: '老师可能在保护培养进度、项目交付或管理秩序；你在保护就业机会与职业起点。现在缺的不是一句“谁对”，而是把拒绝理由、制度边界和可接受条件说具体。',
    knownFacts: ['老师目前不同意你离校实习。', '你认为实习经历会影响秋招竞争力，而且招聘有明确时间窗口。'],
    unknowns: ['这是学校或院系的硬性规定，还是老师基于项目、出勤或风险的个人判断？', '如果学习与项目交付有保证，老师是否接受远程、短期、分时或试行方案？'],
    options: [
      '先查培养方案、实习规定和同专业先例，确认老师的权限与学校底线。',
      '和老师约一次只谈条件的沟通：请对方说清最担心的风险，以及满足哪些条件可以放行。',
      '带着书面方案协商两周试行：时间安排、周交付、在校节点、退出条件都写清；若仍只有笼统拒绝，再向辅导员或院系教学负责人咨询规则。',
    ],
    firstAction: '今天先做一页纸：左边写秋招与实习的关键日期，右边写课程、科研和毕业交付；再列出一个“两周可撤回”的实习安排。它能把“让我去”变成“怎样做才可接受”。',
    conversationScript: '“老师，我理解您担心实习影响培养或项目。我也担心错过秋招窗口。您最不能接受的具体风险是什么？如果我保证每周交付、关键节点到校，并先试行两周，达到哪些条件您会愿意重新考虑？”',
    escalationBoundary: '如果对方说明了明确规则，就按规则补条件；如果多次沟通仍拒绝说明依据，且确实影响培养或就业权益，再拿着时间线和书面方案向辅导员、研究生秘书或院系负责人做规则咨询。先咨询，不先控诉。',
  }
}

const FALLBACKS: Record<WorldThemeId, () => RealWorldAnalysis> = {
  workplace: () => ({
    situationSummary: '你遇到的是贡献、关系与评价机制同时纠缠的问题：你希望自己的投入被看见，又担心直接争取会破坏合作或被认为难相处。',
    emotionalAcknowledgement: '觉得委屈、生气或不安并不矫情。付出被忽略会伤害公平感，而你还要计算表达之后的关系成本。',
    coreConflict: '关键不是先判断对方是否故意，而是让贡献事实进入一个第三方看得懂的记录与沟通过程。',
    knownFacts: ['你认为自己的实际贡献没有被充分呈现。', '这件事已经影响到你的公平感或后续评价预期。'],
    unknowns: ['对方是有意排除、表达疏漏，还是双方对贡献边界理解不同？', '现有邮件、版本记录、会议纪要或交付物能支持到什么程度？'],
    options: ['整理三条“我做了什么—产生什么结果”的记录。', '先私下核对事实与下一次署名方式，不在公开场合争动机。', '若评价即将落定且沟通无效，向有权限的人提交简短事实时间线。'],
    firstAction: '用十分钟写出三条可验证贡献，每条只放动作、时间和结果；先不写“抢功”或“针对我”。',
    conversationScript: '“我想核对一下这次交付的分工。我负责了___，对应记录是___。这次汇报里没有体现。我们能否补充说明，并约定下次怎样署名？”',
    escalationBoundary: '私下核对后仍拒绝修正，且会影响绩效、署名或实际权益时，再带事实记录咨询负责人；不要只转述双方情绪。',
  }),
  relationship: () => ({
    situationSummary: '你在一段重要关系里既想被理解，也担心表达需要会引发冲突、疏远或失去边界。',
    emotionalAcknowledgement: '一边在乎、一边想保护自己，会让人反复猜测和消耗。这不说明你太敏感，而是当前互动缺少足够清楚的确认。',
    coreConflict: '冲突表面是某次行为，底层往往是双方保护的需要和可接受边界不同；这些不能只靠猜。',
    knownFacts: ['某些具体互动让你感到不舒服或不被理解。', '你仍在意这段关系以及表达之后的影响。'],
    unknowns: ['对方如何理解那次互动，以及他真正想保护什么？', '双方是否愿意尝试一个有期限、可退出的新约定？'],
    options: ['选一个最近的具体事件，分开行为、感受和猜测。', '用“发生了什么—我感受到—我需要”开启一次短对话。', '提出一个只试一周的小约定，并约好什么时候复盘。'],
    firstAction: '先写下一次具体事件，不用“总是、从来、根本不在乎”；只写可观察行为和它对你的影响。',
    conversationScript: '“当___发生时，我感到___，因为我很在意___。我不想猜你的动机。你当时怎么理解？我们能不能先试一周___？”',
    escalationBoundary: '若对方持续羞辱、威胁、控制或无视明确边界，重点不再是优化话术，而是寻求可信任的人与专业支持并优先保证安全。',
  }),
  decision: () => ({
    situationSummary: '你面对的不是一个靠想通就能解决的选择：不同方案各自保护了重要东西，而时间、信息或他人的意见又在催你尽快决定。',
    emotionalAcknowledgement: '犹豫和焦虑通常意味着代价真实存在，不代表你不够果断。你是在努力避免把未来交给一个信息不足的决定。',
    coreConflict: '当前需要分开三类东西：已经确定的条件、最担心但尚未验证的结果，以及一旦发生就很难回头的部分。',
    knownFacts: ['你面前至少有两种方向或相互冲突的要求。', '你担心选错后的代价，因此单靠利弊清单仍不踏实。'],
    unknowns: ['哪个关键担心有事实支持，哪个只是最坏情况推演？', '哪部分可以先试，哪部分会造成真正不可逆的承诺？'],
    options: ['把每个选项的确定条件和主观预测分栏。', '找一个真实信息源，只验证最影响决定的一个假设。', '为更想尝试的方向设计期限、成本上限和退出条件。'],
    firstAction: '写下你最怕的三个具体后果，圈出其中一个能在24小时内通过询问、查规则或小测试获得新信息的假设。',
    conversationScript: '“我现在不是要立刻承诺。我最需要核实的是___。能否先用___的方式试到___日期，到时按___标准决定继续还是退出？”',
    escalationBoundary: '如果决定涉及合同、学业、健康或较大财务损失，先向对应专业人士核实规则；不要把低风险试验当成对高风险后果的保证。',
  }),
  growth: () => ({
    situationSummary: '你似乎正把一次不理想的结果，慢慢解释成对自己能力或价值的整体判断。真正需要处理的可能是一个具体方法、反馈或环境问题。',
    emotionalAcknowledgement: '失望和自我怀疑会让人很难再开始。你不需要马上积极起来；先把“我不行”缩小成一件可以观察的事就够了。',
    coreConflict: '一次结果能说明某种做法没有奏效，但还不足以说明你这个人没有能力。要找的是卡住的具体环节。',
    knownFacts: ['有一次结果没有达到你的期待。', '这件事正在影响你对自己的判断或下一次行动。'],
    unknowns: ['问题主要来自知识、方法、练习量、反馈还是环境？', '如果只换一个步骤，结果会不会出现可观察的变化？'],
    options: ['把任务拆成三个步骤，标出具体卡点。', '找一个只评价行为的反馈来源。', '针对一个卡点做二十分钟练习，只记录变化。'],
    firstAction: '选出最具体的一个卡点，做二十分钟练习；结束后只写“做了什么、哪里卡住、下一次改什么”，不给自己打总分。',
    conversationScript: '“我不需要一句‘加油’或‘你不行’。请只告诉我：刚才哪个具体动作有效，哪个步骤最值得先改？”',
    escalationBoundary: '如果低落、焦虑或自我否定持续影响睡眠、饮食、学习工作或安全，请联系可信任的人与专业支持；产品不能替代心理或医疗服务。',
  }),
}

export function buildLocalRealWorldAnalysis(source: string, themeId: WorldThemeId): RealWorldAnalysis {
  if (/(老师|导师|学校|研究生).*(实习|秋招|校招)|(?:实习|秋招|校招).*(老师|导师|学校|毕业)/.test(source)) {
    return educationInternshipAnalysis()
  }
  const fallback = FALLBACKS[themeId]()
  const normalized = source.replace(/\s+/g, ' ').trim()
  const excerpt = normalized.length > 92 ? `${normalized.slice(0, 90)}…` : normalized
  const counterpart = normalized.match(/(?:同事|老板|领导|合伙人|客户|伴侣|男友|女友|丈夫|妻子|父母|妈妈|爸爸|家人|孩子|老师|导师|学生|朋友|室友|学校|公司|团队)/)?.[0] || '相关的人'
  const timing = normalized.match(/(?:今天|明天|后天|下周|下个月|月底|年底|秋招|校招|毕业前|\d+\s*(?:天|周|个月|年)(?:内|后|前)?)/)?.[0]
  const place = normalized.match(/(?:北京|上海|广州|深圳|南京|杭州|成都|武汉|学校|公司|家里|老家|异地|外地)/)?.[0]
  const constraints = [timing, place].filter(Boolean).join('、')
  return {
    ...fallback,
    situationSummary: `你报告的是：“${excerpt}”。这件事把你自己的需要、${counterpart}的期待${constraints ? `，以及${constraints}的现实约束` : ''}压在了同一个决定里。`,
    emotionalAcknowledgement: `${fallback.emotionalAcknowledgement} 你不需要先证明谁对谁错，才能承认这件事对你确实有压力。`,
    coreConflict: `目前不能只凭这段叙述判断${counterpart}的动机。更值得先拆开的是：你与${counterpart}各自在保护什么、哪些代价已经发生、哪些只是担心，以及是否有附条件或分阶段的中间方案。`,
    knownFacts: [`你明确报告了：“${excerpt}”。`, `${counterpart}的期待或行动正在影响你的现实决定${constraints ? `，其中涉及${constraints}` : ''}。`],
    unknowns: [`${counterpart}真正想保护的目标、依据和可接受条件是什么？`, '你最担心的后果中，哪些会真实发生、哪些可以通过时间表、分工或退出条件降低？'],
    options: [
      `先把“${excerpt}”拆成已发生的事实、你担心的结果和需要${counterpart}确认的一个问题。`,
      `与${counterpart}约一次短对话，只核对依据、最担心的风险和满足哪些条件可以调整。`,
      `若需要做决定，先提出一个有期限、成本上限和退出条件的方案；若涉及正式权利或高风险，再找有权限的第三方核实。`,
    ],
    firstAction: `今天先写一页：你能确认的两项事实、${counterpart}需要回答的一个问题，以及你不能承受的代价。不要先写对方动机。`,
    conversationScript: `“关于这件事，我现在能确认的是……。它对我的影响是……。我不想先猜你的动机，想确认：你最担心什么，依据是什么，满足哪些条件可以调整？我们能否先讨论一个有期限、可退出的方案？” 也可以按这个场景具体化：${fallback.conversationScript}`,
  }
}
