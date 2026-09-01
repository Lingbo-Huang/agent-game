import type { AgeBand, CompanionId, EmotionId, SentenceId, StoryStep } from '../types'

export interface ChildStoryProfile {
  id: 'inclusion' | 'conflict' | 'setback' | 'worry'
  title: string
  intro: string
  perspectiveIntro: string
  perspectiveTitle: string
  known: string
  unknown: string
  sentences: typeof sentences
  outcomes: typeof outcomes
  cardTitle: string
  parentQuestion: string
  familyAction: string
}

export const goals = ['说出自己的需要', '试着看见别人', '被拒绝后照顾自己']

export const emotions: Array<{ id: EmotionId; name: string; hint: string; symbol: string }> = [
  { id: 'rain', name: '一朵装满雨的云', hint: '委屈，沉甸甸的', symbol: '☂' },
  { id: 'fire', name: '一团噼啪响的火', hint: '生气，热乎乎的', symbol: '✦' },
  { id: 'stone', name: '一块缩起来的石头', hint: '难过，不想说话', symbol: '●' },
  { id: 'wind', name: '一阵乱跑的风', hint: '不知道，有点混乱', symbol: '≈' },
]

export const companions: Array<{
  id: CompanionId
  name: string
  kind: string
  short: string
  advice: string
  principle: string
}> = [
  {
    id: 'chongchong',
    name: '冲冲',
    kind: 'bird',
    short: '先行动',
    advice: '马上走过去问清楚！不试一试，怎么知道呢？',
    principle: '勇敢直接，但有时跑得比问题还快。',
  },
  {
    id: 'manman',
    name: '慢慢',
    kind: 'turtle',
    short: '先观察',
    advice: '先在旁边看看吧。等我弄明白发生了什么，再决定要不要过去。',
    principle: '谨慎周全，但有时会等到机会溜走。',
  },
  {
    id: 'tingting',
    name: '听听',
    kind: 'rabbit',
    short: '先问一问',
    advice: '也许小熊也有点紧张。我们可以先问问，而不是替它猜答案。',
    principle: '善于体会别人，也会提醒自己别忘了小狐狸。',
  },
]

export const sentences: Array<{ id: SentenceId; title: string; text: string; tone: string }> = [
  { id: 'join', title: '说出愿望', text: '“我也想一起演奏，可以告诉我还缺什么吗？”', tone: '好奇地问' },
  { id: 'boundary', title: '说出感受', text: '“刚才没有人问我，我有点难过。下次可以也问问我吗？”', tone: '认真地说' },
  { id: 'leave', title: '照顾自己', text: '“我现在想先离开一下，去找一个欢迎我的地方。”', tone: '平静地说' },
]

export const outcomes: Record<SentenceId, { title: string; body: string; bear: string; learning: string }> = {
  join: {
    title: '原来，圈里少的不只是椅子',
    body: '小熊愣了一下。它一直忙着数椅子，以为小狐狸只是路过。圆圈里确实坐不下了，但乐队还缺一个摇铃手。',
    bear: '“我没发现你也想参加。你愿意试试摇铃吗？”',
    learning: '问清楚没有保证答案一定是“好”，但它让别人有机会听见你的愿望。',
  },
  boundary: {
    title: '一句真话，让大家慢了下来',
    body: '小熊把手里的名单放下了。它没有立刻想出办法，却第一次意识到：只顾着安排座位，也可能让别人觉得自己不重要。',
    bear: '“谢谢你告诉我。我刚才真的没有想到这一点。”',
    learning: '表达感受不是指责。你可以让别人知道一件事怎样影响了你。',
  },
  leave: {
    title: '小狐狸为自己找到一小块空地',
    body: '小狐狸走到溪边，冲冲、慢慢和听听都跟了过来。他们用石子敲节拍，也开始了一场小小的音乐会。',
    bear: '远处的小熊挥了挥手。也许它晚些时候会走过来，也许不会。',
    learning: '离开不是认输。有时照顾自己，是在被拒绝后仍记得自己值得被好好对待。',
  },
}

const conflictSentences: typeof sentences = [
  { id: 'join', title: '先把事情说清楚', text: '“我也想用这支画笔。你还需要多久，我们可以轮流吗？”', tone: '好奇地问' },
  { id: 'boundary', title: '说出边界', text: '“你刚才拿走画笔时没有问我，我有点生气。请先问一声。”', tone: '认真地说' },
  { id: 'leave', title: '先让自己平静', text: '“我现在太生气了，想先停一下，等会儿再一起想办法。”', tone: '慢慢地说' },
]

const setbackSentences: typeof sentences = [
  { id: 'join', title: '请别人给具体反馈', text: '“我还想再试一次。你能告诉我，哪一步最值得先改吗？”', tone: '好奇地问' },
  { id: 'boundary', title: '不让结果定义自己', text: '“这次没有成功让我很难过，但它不等于我什么都做不好。”', tone: '坚定地说' },
  { id: 'leave', title: '先恢复力气', text: '“我想先休息一下，等有力气时再练一个最小的部分。”', tone: '温柔地说' },
]

const worrySentences: typeof sentences = [
  { id: 'join', title: '把害怕变成问题', text: '“我有一点害怕。你能先告诉我，第一步会发生什么吗？”', tone: '小声地问' },
  { id: 'boundary', title: '请可信任的人陪伴', text: '“我现在还不想一个人去。可以请你先陪我走一小段吗？”', tone: '认真地说' },
  { id: 'leave', title: '允许今天先停下', text: '“我今天准备得还不够，想先停在这里，明天再试一点点。”', tone: '平静地说' },
]

const profiles: Record<ChildStoryProfile['id'], ChildStoryProfile> = {
  inclusion: {
    id: 'inclusion', title: '森林音乐会少了一把椅子',
    intro: '小狐狸来到音乐会，发现大家已经围成了一圈。它站在圈外，不知道该走近，还是转身离开。',
    perspectiveIntro: '小熊只顾着数椅子，以为小狐狸只是路过。它没有看见小狐狸一路练习的乐谱。',
    perspectiveTitle: '换一个座位，看看小熊看见了什么。', known: '三把椅子都坐满了', unknown: '小狐狸也想参加音乐会',
    sentences, outcomes, cardTitle: '我可以说出自己的愿望，也可以照顾自己。',
    parentQuestion: '如果明天又遇到像“少了一把椅子”的时刻，你希望我怎么帮你？', familyAction: '今晚轮流说一次：“我希望 ______。”',
  },
  conflict: {
    id: 'conflict', title: '森林画室只剩一支蓝画笔',
    intro: '小狐狸正要给天空涂色，小熊却把最后一支蓝画笔拿走了。两个人都觉得自己先拿到，也都不想退让。',
    perspectiveIntro: '小熊一直低头画海浪，以为小狐狸已经画完了。它没有看见小狐狸在旁边等了很久。',
    perspectiveTitle: '换一个位置，看看争执另一边的人看见了什么。', known: '自己的海浪还差最后几笔', unknown: '小狐狸已经等了很久',
    sentences: conflictSentences,
    outcomes: {
      join: { title: '一支画笔，也可以有一张时间表', body: '小熊看了看还没画完的海浪，又看见小狐狸空着的手。他们决定每人再画三分钟。', bear: '“我以为你已经不用了。我们轮流吧。”', learning: '协商不保证每个人立刻如愿，但能把“抢”变成可以讨论的规则。' },
      boundary: { title: '清楚的边界，让手慢了下来', body: '小熊停下了动作。它还想画完，但明白拿别人正在用的东西前应该先问。', bear: '“我刚才太着急了。下次我会先问。”', learning: '说边界是在告诉别人怎样和你相处，不等于攻击对方。' },
      leave: { title: '先停一下，不等于不解决', body: '小狐狸去洗了洗爪子，等胸口那团火小一点，再回来和小熊商量。', bear: '“我会把画笔放在这里，等你回来。”', learning: '情绪太大时先暂停，能让你有机会选择，而不是被怒气推着走。' },
    },
    cardTitle: '我可以说清规则，也可以先让自己平静。',
    parentQuestion: '下一次发生争抢时，你希望我先帮你停一下，还是陪你把规则说出来？', familyAction: '一起约定一句：“用别人的东西前，我先 ______。”',
  },
  setback: {
    id: 'setback', title: '风筝比赛里的一阵乱风',
    intro: '小狐狸练了很久，风筝还是最早掉了下来。大家继续欢呼，它却觉得这次失败好像在说：自己什么都做不好。',
    perspectiveIntro: '小熊只看见风筝落下，没有看见小狐狸练习时已经学会了打结和逆风起跑。一次结果没有装下全部变化。',
    perspectiveTitle: '把镜头拉远，看看一次结果没有拍到什么。', known: '这一次风筝很快落下了', unknown: '练习已经带来的具体进步',
    sentences: setbackSentences,
    outcomes: {
      join: { title: '失败开始变成一张小地图', body: '小熊没有说“下次一定赢”，只指出风筝转弯时线放得太快。小狐狸终于有了一个可以练的地方。', bear: '“先只练转弯，好吗？我可以帮你看。”', learning: '具体反馈能指导下一步；“我不行”只会把路全部盖住。' },
      boundary: { title: '一场比赛，不能替一个人下结论', body: '小狐狸把掉下来的风筝捡起。失望还在，但它不再把一次结果写成自己的名字。', bear: '“今天风筝掉了，但我看见你已经会自己打结了。”', learning: '结果可以评价一次尝试，不能定义完整的你。' },
      leave: { title: '休息以后，力气慢慢回来', body: '小狐狸把风筝放在树边，先去喝水。它决定明天只练十分钟起跑。', bear: '“风筝会在这里，等你准备好。”', learning: '休息不是放弃。把任务缩小，常常比逼自己立刻振作更有用。' },
    },
    cardTitle: '一次结果不定义我；我可以只练下一小步。',
    parentQuestion: '当事情没做好时，你希望我先听你说，还是帮你找一个最小的下一步？', familyAction: '今晚各说一次：“我还不会 ______，但我可以先试 ______。”',
  },
  worry: {
    id: 'worry', title: '月光小路上的第一盏灯',
    intro: '明天，小狐狸要第一次独自走过月光小路。大家说那条路并不远，可它的肚子还是像打了一个紧紧的结。',
    perspectiveIntro: '小熊只看见自己熟悉的短路，没有感受到第一次出发的人会遇见多少未知。熟悉和安全感并不是同一件事。',
    perspectiveTitle: '站到走过很多次的人身边，看看双方少知道了什么。', known: '这条路确实不长', unknown: '第一次出发时哪些地方最让人害怕',
    sentences: worrySentences,
    outcomes: {
      join: { title: '未知被拆成了第一小步', body: '小熊画出第一盏灯、拐弯和终点。小狐狸发现自己不用一次想完整条路。', bear: '“我们先只走到第一盏灯，再决定下一步。”', learning: '问清第一步，能把一团很大的害怕变成可以处理的小块。' },
      boundary: { title: '有人陪一段，也是一种勇敢', body: '小熊没有催小狐狸证明自己，而是答应先陪它走到拐弯处。', bear: '“你来决定什么时候想自己继续。”', learning: '请求陪伴不是软弱。安全感足够时，勇气才有地方长出来。' },
      leave: { title: '今天停下，也保留了明天', body: '小狐狸先在家门口练习辨认路灯。它没有勉强自己，也没有把那条路永远关上。', bear: '“明天我们可以再多走一盏灯。”', learning: '循序渐进不是逃避；可控的小尝试会给身体新的安全经验。' },
    },
    cardTitle: '我可以害怕，也可以只走到下一盏灯。',
    parentQuestion: '下次你害怕新事情时，希望我先解释、陪伴，还是允许你慢一点？', familyAction: '一起画三步小地图，并圈出“今天只做到这里”的位置。',
  },
}

export function compileChildStory(source: string, ageBand: AgeBand = '7-9', learningGoal = '说出自己的需要'): ChildStoryProfile {
  const base = /吵|抢|争|生气|打架|冲突|不公平|拿走/.test(source)
    ? profiles.conflict
    : /失败|没考好|考试|比赛|做不好|不会|输|被批评|犯错/.test(source)
      ? profiles.setback
      : /害怕|担心|焦虑|紧张|不敢|第一次|陌生|睡不着/.test(source)
        ? profiles.worry
        : profiles.inclusion
  const preferredSentence: SentenceId = learningGoal === '被拒绝后照顾自己'
    ? 'leave'
    : learningGoal === '试着看见别人'
      ? 'boundary'
      : 'join'
  const orderedSentences = [...base.sentences].sort((left, right) => Number(right.id === preferredSentence) - Number(left.id === preferredSentence))
  const ageCopy: Record<AgeBand, Pick<ChildStoryProfile, 'cardTitle' | 'parentQuestion' | 'familyAction'>> = {
    '4-6': {
      cardTitle: `我能说出感觉，也能试一个小办法。`,
      parentQuestion: '下次再遇到这种事，你想让我抱抱你、听你说，还是陪你一起想办法？',
      familyAction: '轮流说一句：“我感觉 ______，我希望 ______。”',
    },
    '7-9': { cardTitle: base.cardTitle, parentQuestion: base.parentQuestion, familyAction: base.familyAction },
    '10-12': {
      cardTitle: `${base.cardTitle} 我也可以分开事实、猜测和自己的需要。`,
      parentQuestion: '如果同样的事再发生，哪些是你能确认的事实，哪些只是猜测？你希望我怎样支持而不是替你决定？',
      familyAction: '一起写三栏：我知道的事实 / 我正在猜的 / 我愿意尝试的一小步。',
    },
  }
  return { ...base, sentences: orderedSentences, ...ageCopy[ageBand] }
}

export const progressSteps: Array<{ step: StoryStep; label: string }> = [
  { step: 'emotion', label: '情绪罗盘' },
  { step: 'companions', label: '听听伙伴' },
  { step: 'perspective', label: '换个座位' },
  { step: 'sentence', label: '拼一句话' },
  { step: 'outcome', label: '看看结果' },
  { step: 'card', label: '勇气卡' },
]

export const emotionName = (id?: EmotionId) => emotions.find((emotion) => emotion.id === id)?.name ?? '一种还没说清楚的感觉'
