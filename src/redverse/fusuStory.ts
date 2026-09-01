export interface FusuChoice {
  id: string
  title: string
  consequence: string
}

export interface FusuBeat {
  location: string
  speaker: string
  history: string
  hypothesis: string
  prompt: string
  choices: FusuChoice[]
}

/**
 * “魂穿扶苏”历史推演包。history 只写可核对背景；玩家选择和后果全部标为互动假设。
 */
export const fusuBeats: FusuBeat[] = [
  {
    location: '上郡营帐', speaker: '扶苏',
    history: '秦始皇三十五年，扶苏因劝谏坑杀诸生，被派往上郡监蒙恬军。',
    hypothesis: '你无法知道皇帝是否会回心转意，只能先判断自己在边地还能保留哪些行动空间。',
    prompt: '抵达上郡的第一夜，你先做什么？',
    choices: [
      { id: 'map-power', title: '画出军政权力图', consequence: '你分清诏令、军权与地方行政分别由谁掌握。' },
      { id: 'write-defense', title: '立刻写长信自辩', consequence: '你留下立场，却在尚未掌握传递链时暴露全部判断。' },
      { id: 'inspect-border', title: '先巡视边防', consequence: '你获得真实局势，也推迟了处理中央关系。' },
    ],
  },
  {
    location: '中军大帐', speaker: '蒙恬',
    history: '蒙恬统兵北击匈奴、修筑长城，与扶苏在上郡共事。',
    hypothesis: '忠诚并不等于盲从；可靠同盟需要先说清彼此不能承担的代价。',
    prompt: '蒙恬问你希望他在什么边界内支持你。',
    choices: [
      { id: 'set-boundary', title: '约定只做合法核验', consequence: '你获得一位有边界的盟友，而不是一张空白支票。' },
      { id: 'demand-loyalty', title: '要求无条件效忠', consequence: '你得到口头承诺，却让真实分歧被压到危机时爆发。' },
      { id: 'keep-distance', title: '保持君臣距离', consequence: '你降低结党嫌疑，也失去共同校验情报的机会。' },
    ],
  },
  {
    location: '边地驿站', speaker: '驿卒',
    history: '秦以严密驿传维系中央与郡县，但传递者、符节与封缄仍是信息链的一部分。',
    hypothesis: '消息越重大，越不能只看内容；来源、权限和传递过程同样是证据。',
    prompt: '一封语气异常严厉的私信先于正式诏书抵达。',
    choices: [
      { id: 'check-chain', title: '核对符节与驿传记录', consequence: '你没有猜作者动机，先检查消息是否经过可复核的渠道。' },
      { id: 'trust-tone', title: '凭父皇语气判断真伪', consequence: '你把熟悉感当成鉴权，忽略文字可能被他人代写。' },
      { id: 'detain-messenger', title: '先扣下送信人', consequence: '你争取询问时间，也可能破坏合法驿传并制造恐慌。' },
    ],
  },
  {
    location: '上郡粮仓', speaker: '军吏',
    history: '边军依赖稳定粮道；任何政治行动都受军粮、民生与季节约束。',
    hypothesis: '宏大选择必须先折算成普通人会承担的成本。',
    prompt: '军吏提醒：若边军因中央风波停摆，粮道只能维持二十日。',
    choices: [
      { id: 'protect-supply', title: '先保障军粮与换防', consequence: '你把士卒生计从政治豪赌中隔离出来。' },
      { id: 'stockpile', title: '秘密囤粮准备对抗', consequence: '你增加自主时间，也让防御准备看起来像叛乱证据。' },
      { id: 'ignore-logistics', title: '认为大义高于粮道', consequence: '立场更纯粹，实际代价却被转嫁给无法选择的人。' },
    ],
  },
  {
    location: '咸阳来使馆', speaker: '使者',
    history: '秦始皇三十七年病逝沙丘；《史记》记载赵高、李斯与胡亥秘不发丧并矫诏。',
    hypothesis: '这是史籍记载与后世叙述交汇处；互动不能证明每个细节，只能训练异常核验。',
    prompt: '正式诏书命你与蒙恬自裁，且催促立即执行。',
    choices: [
      { id: 'request-second-source', title: '要求独立副本与当面复核', consequence: '你把不可逆命令暂时转换为可核验程序。' },
      { id: 'obey-now', title: '以孝为先立即服从', consequence: '你守住一种忠孝解释，也放弃纠正伪命令的可能。' },
      { id: 'declare-fake', title: '当场宣布诏书必伪', consequence: '你拒绝不可逆后果，却在证据不足时先下了结论。' },
    ],
  },
  {
    location: '中军大帐', speaker: '蒙恬',
    history: '《史记》写蒙恬曾劝扶苏复请，扶苏认为父命赐死无需再请。',
    hypothesis: '两人的冲突不是一忠一奸，而是对服从、程序与风险的排序不同。',
    prompt: '蒙恬主张复请。你怎样回应这份不同意见？',
    choices: [
      { id: 'record-dissent', title: '记录异议并共同复核', consequence: '你允许忠诚的人提出反证，降低单点判断风险。' },
      { id: 'silence-mengtian', title: '阻止他继续质疑', consequence: '命令保持整齐，但关键反证被权威压掉。' },
      { id: 'hand-over', title: '把决定全交给蒙恬', consequence: '你避开责任，却让军权承担本应由你解释的政治后果。' },
    ],
  },
  {
    location: '边地驿站', speaker: '你',
    history: '史籍没有留下扶苏实际组织独立复核的过程。以下均为明确标注的 What-if。',
    hypothesis: '历史推演的价值在检验决策结构，不在宣称“这样做一定能改写历史”。',
    prompt: '你只能送出一封短函，最关键的问题写什么？',
    choices: [
      { id: 'ask-authority', title: '问诏书授权与副本所在', consequence: '问题指向可核验程序，不要求对方先相信你的动机。' },
      { id: 'plead-love', title: '诉说父子感情', consequence: '信件更动人，却没有给核验者一个可执行的问题。' },
      { id: 'threaten-force', title: '以边军威胁回复', consequence: '你可能更快收到回应，也把核验变成军事对抗。' },
    ],
  },
  {
    location: '上郡城门', speaker: '守将',
    history: '扶苏与蒙恬掌握重要边军，任何拒命都可能被解释为叛乱。',
    hypothesis: '争取核验时间不等于无限拖延，需要明确期限和不升级承诺。',
    prompt: '使者要求开城接管军印，你怎样设置等待边界？',
    choices: [
      { id: 'timebox-review', title: '封存军印，限时复核', consequence: '你同时阻止擅自动兵与立即交出唯一谈判筹码。' },
      { id: 'mobilize-army', title: '集结边军拒绝接管', consequence: '你强化防御，也让最坏的叛乱解释迅速成真。' },
      { id: 'surrender-seal', title: '立即交出军印', consequence: '你避免眼前冲突，也失去保护复核过程的能力。' },
    ],
  },
  {
    location: '复核席', speaker: '史官',
    history: '真实历史中，扶苏自杀，蒙恬后被囚并死；胡亥即位，是为秦二世。',
    hypothesis: 'What-if 不能把结构性风险写成主角聪明就必胜。即使核验正确，权力仍可能拒绝纠错。',
    prompt: '复核材料出现冲突，你怎样向军民说明？',
    choices: [
      { id: 'separate-known', title: '分开已知、推断与未知', consequence: '你降低谣言速度，也诚实承认证据仍有缺口。' },
      { id: 'announce-victory', title: '宣布已经查明阴谋', consequence: '支持者更振奋，未来任何反证都会伤害可信度。' },
      { id: 'hide-conflict', title: '暂不公开任何信息', consequence: '你保留谈判空间，却把不确定留给流言填满。' },
    ],
  },
  {
    location: '现代回响室', speaker: '你',
    history: '本局没有改写史实；你经历的是对决策约束的现代推演。',
    hypothesis: '现实中的不可逆命令，也值得先检查权限、独立来源、退出条件和被波及者成本。',
    prompt: '面对一项来源异常、后果不可逆的命令，你最先带走哪一步？',
    choices: [
      { id: 'verify-before-irreversible', title: '不可逆前做独立复核', consequence: '你不把怀疑当结论，但拒绝在信息链异常时立即承担永久后果。' },
      { id: 'protect-bystanders', title: '先隔离无辜者的代价', consequence: '你让判断错误的成本不必由最弱势的人先承担。' },
      { id: 'preserve-exit', title: '先保留一个合法退出口', consequence: '你争取纠错空间，同时限制行动升级。' },
    ],
  },
]
