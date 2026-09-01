export type ClassicChoiceId = string

export interface ClassicChoice { id: ClassicChoiceId; title: string; consequence: string }
export interface ClassicBeat {
  canon: string
  interpretation: string
  prompt: string
  speaker: string
  tension: string
  choices: ClassicChoice[]
}

/**
 * 《草船借箭》12 幕 PGC。每幕只把原作确定事实放在 canon；玩家选择均为
 * What-if 推演，不冒充原作。三位角色用稳定的利益、语气和风险偏好贯穿全局。
 */
export const classicBeats: ClassicBeat[] = [
  {
    speaker: '周瑜', tension: '体面之下的试探', canon: '周瑜妒忌诸葛亮的才干，在军中商议对敌之策时提出造箭任务。',
    interpretation: '周瑜很少直接承认忌惮。他把杀机包进军令，让每句话都显得合乎礼制。',
    prompt: '你是鲁肃。周瑜语气温和地问：“水上交战，用什么兵器最好？”你先注意什么？',
    choices: [
      { id: 'read-courtesy', title: '听懂客气话里的压力', consequence: '你没有被礼貌表面迷惑，开始观察任务背后的权力关系。' },
      { id: 'answer-literally', title: '只按字面讨论兵器', consequence: '你暂时保住了中立，却错过了周瑜真正测试谁的信号。' },
      { id: 'challenge-zhou', title: '当众质问为何为难诸葛亮', consequence: '你直指矛盾，也让周瑜必须在众人面前维护自己的体面。' },
    ],
  },
  {
    speaker: '诸葛亮', tension: '把压力变成约束', canon: '周瑜命诸葛亮十日造十万支箭，诸葛亮主动改为三日，并立下军令状。',
    interpretation: '诸葛亮没有在对方设定的制造问题里苦熬，而是重新定义资源、时间和胜负条件。',
    prompt: '三日十万支箭，听起来像自杀式 KPI。你怎样判断诸葛亮是不是在逞强？',
    choices: [
      { id: 'ask-resource', title: '追问他依赖哪些资源', consequence: '你把“神机妙算”拆成天气、船、人手和对手反应。' },
      { id: 'trust-fame', title: '相信聪明人自有办法', consequence: '你节省了质询成本，也把自己的风险完全交给了名声。' },
      { id: 'refuse-oath', title: '劝他撤回军令状', consequence: '你试图降低不可逆风险，却可能破坏他利用期限反制周瑜的布局。' },
    ],
  },
  {
    speaker: '鲁肃', tension: '有限信任', canon: '诸葛亮请鲁肃准备二十条快船、草把子和军士，并要求不要告诉周瑜。',
    interpretation: '鲁肃厚道，却不是没有判断力。他要在联盟忠诚、朋友信任和个人责任之间取界线。',
    prompt: '诸葛亮只告诉你要什么，不告诉你完整计划。你怎么回应？',
    choices: [
      { id: 'lend-with-boundary', title: '借船，但先问清风险', consequence: '你选择有限信任：不要求知道全部，却确认自己承担的边界。' },
      { id: 'report-to-zhou', title: '立刻向周瑜报告', consequence: '你保护了政治安全，但计划可能在开始前暴露。' },
      { id: 'refuse-plan', title: '拒绝参与这场豪赌', consequence: '你避开共谋风险，也失去了验证判断的机会。' },
    ],
  },
  {
    speaker: '周瑜', tension: '控制信息', canon: '鲁肃回报时隐去了借船之事；周瑜疑惑诸葛亮为何迟迟没有动静。',
    interpretation: '周瑜习惯把局面控制在可解释范围。沉默会让他的优雅逐渐变成警觉。',
    prompt: '周瑜问你：“孔明究竟在做什么？”你怎样守住自己的选择？',
    choices: [
      { id: 'state-known', title: '只说自己能确认的部分', consequence: '你不撒一个更大的谎，也不交出尚未验证的计划。' },
      { id: 'invent-decoy', title: '编造一条假进度', consequence: '你争取到时间，却新增了一条日后需要圆回来的风险。' },
      { id: 'confess-ships', title: '说出借船安排', consequence: '你恢复对周瑜的透明，也让诸葛亮失去行动所需的信息差。' },
    ],
  },
  {
    speaker: '诸葛亮', tension: '等待条件', canon: '前两日诸葛亮没有行动，直到第三日四更才请鲁肃上船。',
    interpretation: '高手的等待不是停摆。可控部分已经准备好，只剩不可控条件尚未出现。',
    prompt: '第二夜雾还不够浓，你会怎样处理焦虑？',
    choices: [
      { id: 'prepare-boats', title: '逐船检查绳索与草把', consequence: '你把焦虑转成准备，降低可控制的风险。' },
      { id: 'send-scout', title: '派小船试探江面', consequence: '你得到更多现场信息，也增加被曹军察觉的概率。' },
      { id: 'push-launch', title: '催诸葛亮提前出发', consequence: '你试图夺回主动权，却破坏了计划最重要的天气前提。' },
    ],
  },
  {
    speaker: '鲁肃', tension: '知情后的代价', canon: '鲁肃上船后才知道要驶向曹军水寨，惊问如果曹军出击怎么办。',
    interpretation: '真正的风险常在承诺后才变具体。鲁肃的害怕并不愚蠢，它提醒计划必须有退出条件。',
    prompt: '船已入雾，退回仍来得及。你要求补上什么？',
    choices: [
      { id: 'define-retreat', title: '先约定撤退信号', consequence: '你没有否定计划，而是给极端情况留出退出路径。' },
      { id: 'demand-full-plan', title: '停船直到说清全部', consequence: '你争取完整知情权，却可能错过短暂的大雾窗口。' },
      { id: 'hide-fear', title: '怕显得胆小，什么也不问', consequence: '队伍保持安静，但一个真实风险没有进入共同判断。' },
    ],
  },
  {
    speaker: '诸葛亮', tension: '利用对手人格', canon: '诸葛亮让船只一字排开，船头朝西，军士擂鼓呐喊。',
    interpretation: '计划的核心不是草船，而是对曹操性格的预测：多疑、重控制、不愿在信息不足时近战。',
    prompt: '你负责排列船队。怎样验证“曹操会远射”这个假设？',
    choices: [
      { id: 'stage-signal', title: '先用一艘船测试反应', consequence: '你降低单次暴露，却牺牲了时间和整体声势。' },
      { id: 'full-formation', title: '按计划全线擂鼓', consequence: '你最大化诱因，也把所有船同时放进风险里。' },
      { id: 'silent-approach', title: '静默靠近再判断', consequence: '你减少暴露，却失去诱使对方射箭的关键刺激。' },
    ],
  },
  {
    speaker: '曹操', tension: '聪明人的保守', canon: '曹操听见鼓声，因江上大雾看不清虚实，下令弓弩手乱箭射住，不可轻动。',
    interpretation: '曹操并不愚蠢。他的谨慎在多数夜晚能保命，恰好在这一夜成为可预测的资源。',
    prompt: '你暂代曹营巡江校尉。雾中鼓声逼近，建议怎么做？',
    choices: [
      { id: 'fire-at-sound', title: '向声音方向齐射', consequence: '你避免近战伏击，却可能正中借箭设计。' },
      { id: 'identify-shadow', title: '先辨船影再放箭', consequence: '你减少误判，也给未知目标更长的接近时间。' },
      { id: 'pull-defense', title: '收缩防线等待雾散', consequence: '你保存箭矢，暂时放弃江面主动权。' },
    ],
  },
  {
    speaker: '鲁肃', tension: '成功中的失衡', canon: '一侧草把插满箭后，诸葛亮命船队掉头，让另一侧继续受箭。',
    interpretation: '计划正在成功时最容易忽略新风险：重量失衡、方向暴露、撤退窗口缩短。',
    prompt: '箭越来越多，船身开始倾斜。你先处理什么？',
    choices: [
      { id: 'balance-load', title: '立刻掉头平衡载重', consequence: '你保护船只稳定，也让第二面继续完成目标。' },
      { id: 'chase-quota', title: '先把数量凑到十万', consequence: '你守住 KPI，却把船和人的安全放到最后。' },
      { id: 'retreat-early', title: '见好就收立即撤退', consequence: '你降低人员风险，可能无法兑现军令状。' },
    ],
  },
  {
    speaker: '诸葛亮', tension: '撤退窗口', canon: '诸葛亮估计箭已足够，命军士高喊“谢丞相箭”，顺风顺水撤离。',
    interpretation: '退出也是计划的一部分。公开嘲讽增加戏剧效果，同时可能激怒追兵。',
    prompt: '撤退前要不要高喊“谢箭”？',
    choices: [
      { id: 'thank-cao', title: '照原计划高喊谢箭', consequence: '你制造心理优势，也用挑衅换来更高的追击风险。' },
      { id: 'leave-silent', title: '保持静默迅速撤离', consequence: '你减少刺激，却放弃瓦解对方判断的心理效果。' },
      { id: 'false-direction', title: '制造向另一方向撤退的声响', consequence: '你继续利用信息差，也增加队伍协同失误的可能。' },
    ],
  },
  {
    speaker: '周瑜', tension: '胜利后的归因', canon: '船队取回十余万支箭，诸葛亮按期交付；鲁肃向周瑜说明经过。',
    interpretation: '结果证明计划成功，但成功由判断、准备、天气、执行和对手反应共同构成。',
    prompt: '周瑜听完后仍保持体面。你怎样复盘这次行动？',
    choices: [
      { id: 'separate-factors', title: '把判断与条件逐条拆开', consequence: '你把传奇还原成可学习的方法，也保留不可复制的运气。' },
      { id: 'praise-genius', title: '只强调诸葛亮神机妙算', consequence: '故事更传奇，却遮住天气、物资与执行者的共同贡献。' },
      { id: 'only-result', title: '只交付结果，不谈过程', consequence: '你避开二人矛盾，也让组织失去一次真正学习的机会。' },
    ],
  },
  {
    speaker: '你', tension: '把名著带回现实', canon: '草船借箭以诸葛亮如期交箭、周瑜叹服其谋略结束。',
    interpretation: '经典的价值不在复制奇计，而在学习区分：什么能准备，什么只能预测，什么必须设置退出条件。',
    prompt: '如果现实里也收到一个“不可能任务”，你先带走哪种方法？',
    choices: [
      { id: 'map-control', title: '列出可控、可预测、不可控', consequence: '你先把压力拆成不同类型，再决定把精力投向哪里。' },
      { id: 'small-test', title: '先做一次低成本试探', consequence: '你不用假装拥有全部信息，也能从真实反馈中学习。' },
      { id: 'exit-rule', title: '先写清退出和止损条件', consequence: '你保留尝试的勇气，同时避免一次承诺吞掉所有选择。' },
    ],
  },
]
