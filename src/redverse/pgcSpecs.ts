import type { GenerativePgcSpec } from './GenerativePgcGame'
import { classicBeats } from './classicStory'
import { fusuBeats } from './fusuStory'

export const classicPgcSpec: GenerativePgcSpec = {
  id: 'classic-straw-boats-v2',
  title: '草船借箭',
  eyebrow: '名著 WHAT-IF · 动态续章',
  openingImage: '/pgc/classic/v1/01-riverside-preparation.webp',
  opening: '周瑜把“三日造十万支箭”的军令放到诸葛亮面前。你不需要照原作行动：可以追问、试探、改变计划，也可以直接说出任何想做的事。人物会守住自己的立场，世界会记住船、草把、雾与箭的状态。',
  freeActionExample: '我让鲁肃把船分成两队，先派一艘试探曹军反应。',
  stageGoal: '在不把互动假设冒充原作的前提下，处理三日十万支箭的军令，并让船、人、天气与退出条件真正进入决策。',
  canonConstraints: [
    '原作确定事实与玩家 What-if 必须明确区分，玩家行动不能被写成原作史实。',
    '周瑜重视军令、控制与体面；诸葛亮擅长利用条件但不能预知一切；鲁肃愿意有限信任；曹操在信息不足时偏向谨慎。',
    '箭只能来自已存在的制造、借取或曹军射击；不能凭空出现。',
    '大雾、船只、草把、军士和撤退窗口都是有限条件，使用后必须留下状态变化。',
  ],
  characters: [
    { id: 'zhouyu', principles: ['维护军令与主帅权威', '不轻易公开嫉妒或失控'], goal: '验证并约束诸葛亮的能力', emotion: '克制而警觉', knownFacts: ['造箭军令', '水战资源', '鲁肃与诸葛亮来往'] },
    { id: 'zhuge', principles: ['把压力改写为可利用的约束', '不给盟友虚假的确定性'], goal: '在三日内取得足够箭矢并全员撤回', emotion: '镇定但承受期限压力', knownFacts: ['船与草把计划', '天气窗口', '曹操的风险偏好'] },
    { id: 'lusu', principles: ['忠诚不等于放弃判断', '信任必须有边界和退出条件'], goal: '保护联盟与参与者，不让秘密变成无底线共谋', emotion: '信任与担忧并存', knownFacts: ['借船安排', '周瑜的试探', '部分计划'] },
    { id: 'caocao', principles: ['信息不明时避免把主力投入近战', '保住军队控制权优先'], goal: '判断雾中来敌的真实规模与意图', emotion: '多疑而审慎', knownFacts: ['江面大雾', '鼓声与船影', '本营防御部署'] },
  ],
  items: [
    { id: 'military-order', name: '三日军令状', origin: '周瑜军帐', holder: '诸葛亮', status: '已签立，期限推进中', purpose: '规定十万支箭的不可逆期限', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'boats', name: '二十条快船', origin: '鲁肃调拨', holder: '鲁肃与军士', status: '待准备', purpose: '接近、承载并撤回箭矢', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'straw', name: '草把与青布幔', origin: '军中物料', holder: '军士', status: '尚未装船', purpose: '承接曹军箭矢并遮蔽船上虚实', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'arrows', name: '箭矢', origin: '尚未取得', holder: '无', status: '0 / 100000', purpose: '完成军令并记录真实来源', introducedTurn: 0, lastChangedTurn: 0 },
  ],
  fallbackBeats: classicBeats.map((beat, index) => ({
    location: index < 4 ? '周瑜军帐' : index < 7 ? '江边船坞' : index < 11 ? '大雾江面' : '交箭营地',
    title: beat.tension,
    background: `${beat.canon} ${beat.interpretation}`,
    prompt: beat.prompt,
    choices: beat.choices,
  })),
}

export const fusuPgcSpec: GenerativePgcSpec = {
  id: 'fusu-shangjun-v2',
  title: '魂穿扶苏',
  eyebrow: '历史推演 · 动态续章',
  openingImage: '/pgc/fusu/v1/01-shangjun-opening.webp',
  opening: '上郡夜风压着帐幕。你以扶苏的身份站在军图前，蒙恬正在等你的第一道决定。十幕预写内容现在只是世界史料与可靠兜底：你可以不点按钮，直接质询来使、调阅驿传、巡视粮道，或尝试任何符合当下条件的行动。',
  freeActionExample: '我请蒙恬封存军印，再让驿吏当众核对使者符节与入境时间。',
  stageGoal: '在不把 What-if 冒充史实的前提下，核验异常诏令，保护边军与百姓，并为不可逆决定保留合法复核路径。',
  canonConstraints: [
    '秦始皇三十五年扶苏因劝谏被派往上郡监蒙恬军；三十七年沙丘之变与矫诏来自史籍叙述。',
    '真实历史中扶苏自杀、蒙恬后死；所有改写路线必须标明为互动假设，不能声称必然改写历史。',
    '扶苏重忠孝与名分，蒙恬重军责与复核；二人的分歧不能被简化为忠奸。',
    '军印、诏书、符节、驿传、粮道与边军都有明确持有人和现实代价，不能凭空改变。',
  ],
  characters: [
    { id: 'fusu', principles: ['不以私欲轻启兵祸', '忠孝也不能替代对异常命令的核验'], goal: '在名分、复核与边地安全之间找到可承担的行动', emotion: '克制、困惑且有时间压力', knownFacts: ['自己被派往上郡', '与蒙恬共事', '中央消息链异常'] },
    { id: 'mengtian', principles: ['边军与百姓不能成为政治豪赌筹码', '不可逆命令应当复请'], goal: '保护边防并让诏令经过独立复核', emotion: '警惕且愿意进谏', knownFacts: ['边军部署', '军印控制', '粮道期限'] },
    { id: 'envoy', principles: ['完成诏令交付与接管', '不公开超出使者权限的信息'], goal: '催促扶苏和蒙恬立即执行诏命', emotion: '强硬而戒备', knownFacts: ['诏书文本', '符节与交付流程', '自己的上级命令'] },
    { id: 'recorder', principles: ['把已知、推断与未知分开记录', '不替权力补造证据'], goal: '保存可供复核的时间线与来源链', emotion: '谨慎', knownFacts: ['到达时间', '封缄状态', '公开史实边界'] },
  ],
  items: [
    { id: 'edict', name: '赐死诏书', origin: '咸阳来使', holder: '使者', status: '已送达，真伪与授权链待核', purpose: '不可逆命令的核心文本', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'tally', name: '使者符节', origin: '中央驿传', holder: '使者', status: '待与记录核对', purpose: '核验身份、权限与传递链', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'seal', name: '上郡军印', origin: '边军中枢', holder: '蒙恬', status: '仍在边军控制', purpose: '调兵权力，也是防止局势升级的关键约束', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'relay-log', name: '驿传簿册', origin: '边地驿站', holder: '驿吏', status: '尚未调阅', purpose: '核对来使路线、时间与封缄异常', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'grain-ledger', name: '军粮簿', origin: '上郡粮仓', holder: '军吏', status: '显示粮道只够二十日', purpose: '把政治选择折算为士卒与百姓代价', introducedTurn: 0, lastChangedTurn: 0 },
  ],
  fallbackBeats: fusuBeats.map((beat, index) => ({
    location: beat.location,
    title: `第${index + 1}幕 · ${beat.speaker}`,
    background: `${beat.history} ${beat.hypothesis}`,
    prompt: beat.prompt,
    choices: beat.choices,
  })),
}

const caocaoBeats = [
  ['董卓府暗室', '刺杀暴露', '铜镜里，董卓的目光已经落在你藏刀的手上。门外甲叶相撞，吕布正在走近。', '献刀脱身、强行刺杀、挟持董卓，还是制造混乱？'],
  ['洛阳西门', '逃出洛阳', '城门画像刚刚贴上。马匹、通缉等级、时间和无辜者伤亡都将随方法改变。', '伪造身份、贿赂守卫、借火制造缺口，还是寻找旧识？'],
  ['中牟县衙', '陈宫的判断', '陈宫盯着一路被卷入的人，判断你会不会把人命都当工具。', '你愿意让他看见多少真相，又准备怎样处理追兵？'],
  ['陈留旧宅', '第一支队伍', '家产、宗族与旧交只能支撑一条起步路线。才能带来声望，也让人怀疑你的预知。', '公开募兵、秘密联络、先救流民，还是只招最可靠的人？'],
  ['酸枣盟营', '诸侯讨董', '盟帐里人人高喊大义，却在粮草、地盘和名望上各有算盘。', '公开号召、暗中操盘、争取人才，还是绕开注定瓦解的联盟？'],
  ['颍川书院', '谋士试探', '郭嘉问了一件尚未发生的事。荀彧把你提前布置的三处粮仓记了下来。', '坦白一部分、继续隐瞒、给出解释，还是停止使用前世记忆？'],
  ['兖州疫营', '天意偏差', '你阻止了一场熟悉的败仗，瘟疫却提前出现在另一条粮道。可靠情报第一次失效。', '救治、封锁、继续用旧历史下注，还是承认世界已经改变？'],
  ['徐州雨夜', '权力与亲情', '一份军报给你战略窗口，也把亲人与重要伙伴放进代价里。', '接受牺牲、放弃战机、寻找第三条路，还是让当事人决定？'],
  ['官渡前线', '陌生的官渡', '袁绍、刘备与孙策的阵营已经偏离记忆。旧答案只是一张过期地图。', '决战、结盟、撤退，还是制造一场让各方重新判断你的事件？'],
  ['赤壁回声', '天下归属', '这不是记忆中的赤壁。民心、猜忌、盟友与创伤决定谁愿意站到你身边。', '继续统一、扶汉复兴、诸侯共治，还是放下权力换取救赎？'],
] as const

export const caocaoPgcSpec: GenerativePgcSpec = {
  id: 'caocao-assassination-v1', title: '重回刺董之夜', eyebrow: '旗舰开放历史世界 · 曹操前传',
  openingImage: '/pgc/caocao/v1/01-assassination-exposed.webp',
  opening: '你保留着上一条历史线的记忆，回到刺杀董卓暴露的这一刻。铜镜映出董卓回头，吕布正从门外接近。这里没有读档：历史节点永久写入世界；你可以点建议，也可以直接说任何想做的事。',
  freeActionExample: '我把七星刀举到灯下，说这是王允托我献给相国的宝刀，同时观察董卓和门外吕布的反应。',
  stageGoal: '在权力与救赎之间活过十个不可逆节点；利用前世记忆会同时提高声望、猜忌和天意偏差。',
  canonConstraints: [
    '世界参考东汉末年人物、地理与秩序；玩家选择是互动假设，不能冒充史实。',
    '关键节点不可逆，时间与其他势力持续运行；错过的机会不能靠重复行动追回。',
    '才能与异常预知同时增加声望和猜忌；过度利用前世记忆会触发天气、瘟疫、战争意外或人物提前死亡。',
    '人物只依据自己掌握的信息、立场、欲望和恐惧行动，可能拒绝、欺骗或背叛玩家。',
    '牺牲亲友会积累创伤并影响后续判断，不能被下一章一句话抹除。',
    '使用第二人称历史悬疑、短句、强动作、低解释；选择后先写可感知后果，禁用破折号、空泛哲理和否定加肯定的AI腔。',
  ],
  characters: [
    { id: 'caocao', principles: ['可以欺骗敌人', '牺牲自己人必须由玩家承担'], goal: '结束乱世并避开上一世失败', emotion: '冷静外壳下压着恐惧与野心', knownFacts: ['上一条历史线', '刺杀即将暴露'] },
    { id: 'chengong', principles: ['接受权谋但不接受无底线杀戮'], goal: '寻找真正能结束乱世的明主', emotion: '欣赏与警惕并存', knownFacts: ['曹操判断异常敏锐'] },
    { id: 'xunyu', principles: ['忠诚以维护秩序和汉室为前提'], goal: '结束战争并重建制度', emotion: '克制而持续评估', knownFacts: ['曹操的才能与野心'] },
    { id: 'guojia', principles: ['支持高风险策略', '持续测试主公是否值得追随'], goal: '验证自己对人性与天下的判断', emotion: '好奇而危险', knownFacts: ['曹操提前布局未发生事件'] },
    { id: 'dongzhuo', principles: ['用暴力、恐惧和奖赏维持控制'], goal: '稳固权力并消灭威胁', emotion: '多疑暴躁', knownFacts: ['曹操在近前', '吕布即将进入'] },
    { id: 'lvbu', principles: ['忠诚随尊重、利益与情感变化', '不做可交易武器'], goal: '获得地位、认可和安全', emotion: '自尊、猜忌且易冲动', knownFacts: ['董卓的命令', '曹操可能持刃'] },
    { id: 'liubei', principles: ['以仁义和民心建立合法性', '必要时也用政治手段'], goal: '证明另一条救世道路能结束乱世', emotion: '欣赏与警惕并存', knownFacts: ['曹操的声望与手段'] },
  ],
  items: [
    { id: 'seven-star-blade', name: '七星宝刀', origin: '王允府', holder: '曹操', status: '藏在身后，已被铜镜暴露', purpose: '刺杀武器，也可伪装成献礼', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'previous-memory', name: '前世记忆', origin: '上一条历史线', holder: '曹操', status: '完整但开始偏离现实', purpose: '提供预判，同时累积猜忌与天意偏差', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'wanted-order', name: '洛阳通缉令', origin: '董卓府', holder: '城门守军', status: '尚未发出', purpose: '决定逃亡路线与公开身份', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'seal-token', name: '骑都尉印信', origin: '朝廷', holder: '曹操', status: '仍可使用一次', purpose: '证明身份，也可能暴露行踪', introducedTurn: 0, lastChangedTurn: 0 },
    { id: 'trauma-ledger', name: '未偿代价', origin: '每次牺牲与背叛', holder: '曹操', status: '0', purpose: '记录无法用胜利抵消的创伤', introducedTurn: 0, lastChangedTurn: 0 },
  ],
  fallbackBeats: caocaoBeats.map(([location, title, background, prompt], index) => ({ location, title, background, prompt, choices: [
    { id: `direct-${index}`, title: index === 0 ? '献刀脱身' : '正面承担风险', consequence: '立即改变人物判断，并提高公开声望或暴露程度。' },
    { id: `probe-${index}`, title: '先试探一人', consequence: '用一轮时间换取立场信息，但世界仍会继续运行。' },
    { id: `third-${index}`, title: '寻找第三条路', consequence: '保留更多人和退路，代价是时机更窄、结果更不确定。' },
  ] })),
}
