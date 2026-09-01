import type { GenerativePgcSpec } from './GenerativePgcGame'
import type { GeneratedStoryTurn } from './storyDirector'

type FallbackIntent = 'investigate' | 'talk' | 'move' | 'protect' | 'act'

function classifyFallbackIntent(action: string): FallbackIntent {
  // Movement is authoritative when the player explicitly changes place, even
  // when the sentence also mentions evidence. Otherwise a line such as
  // “潜回王允府取证” incorrectly collapses into the generic investigation
  // template and the authored world appears to ignore the player's plan.
  if (/去|前往|潜回|潜入|赶往|巡视|登|回到|进入|靠近|离开|出城|逃/.test(action)) return 'move'
  if (/查|核|验|看|观察|记录|对照|封泥|符节|底稿|证据/.test(action)) return 'investigate'
  if (/问|谈|说|质询|劝|告诉|交涉|回应/.test(action)) return 'talk'
  if (/封存|保护|等待|暂停|撤|守|止损|保留/.test(action)) return 'protect'
  return 'act'
}

const characterNames: Record<string, string> = {
  caocao: '曹操', chengong: '陈宫', xunyu: '荀彧', guojia: '郭嘉', dongzhuo: '董卓', lvbu: '吕布', liubei: '刘备',
  zhouyu: '周瑜', zhuge: '诸葛亮', lusu: '鲁肃', mengtian: '蒙恬', fusu: '扶苏', envoy: '来使',
}

function characterName(id: string) { return characterNames[id] || id }

function isCaoCaoWorld(spec: GenerativePgcSpec) { return spec.id.startsWith('caocao-') }

function isClassicWorld(spec: GenerativePgcSpec) { return spec.id.startsWith('classic-') }

/** Deterministic Director used only when the remote model is unavailable. */
export function fallbackChapter(spec: GenerativePgcSpec, turn: number, action: string): GeneratedStoryTurn {
  const beat = spec.fallbackBeats[Math.min(turn, spec.fallbackBeats.length - 1)]
  const authoredChoice = beat.choices.find((item) => action.includes(item.title))
  const intent = classifyFallbackIntent(action)
  const nextBeat = spec.fallbackBeats[Math.min(turn + 1, spec.fallbackBeats.length - 1)]
  const mentionedItem = spec.items.find((item) => action.includes(item.name))
  const changedItem = mentionedItem || (intent === 'investigate' ? spec.items[turn % spec.items.length] : intent === 'protect' ? spec.items.find((item) => /印|令|船|粮|诏/.test(item.name)) : undefined)
  const actorIndex = intent === 'talk' ? 0 : intent === 'investigate' ? Math.min(1, spec.characters.length - 1) : intent === 'protect' ? Math.min(2, spec.characters.length - 1) : turn % spec.characters.length
  const actor = spec.characters[actorIndex]
  const actorLabel = characterName(actor.id)
  const visibleAction = action.length > 120 ? `${action.slice(0, 118)}…` : action
  // A committed action closes the current beat. The next visible options must
  // belong to the following beat; otherwise clicking a choice appears to do
  // nothing because the same three buttons are rendered again.
  const authoredNextActions = nextBeat.choices.map((item) => ({ id: `${item.id}-${turn + 1}`, title: item.title, intent: item.consequence }))
  const consequences: Record<FallbackIntent, string> = {
    investigate: `你照自己的计划动手：${visibleAction}。${changedItem ? `${changedItem.name}被翻到明处，状态随即改变。` : '现场留下了一处可见的新痕迹。'}${beat.prompt}`,
    talk: `你把话递到${actorLabel}面前：${visibleAction}。${actorLabel}没有顺着你的意思表态，只按自己眼下知道的事作答。${beat.prompt}`,
    move: `你没有停在原地。你执行“${visibleAction}”，局面随脚步推到${nextBeat.location}。身后的机会开始关闭，眼前的人也因此重新判断你。`,
    protect: `你先执行“${visibleAction}”。一个不可逆动作被暂时按住，但时间没有停止。${beat.prompt}`,
    act: authoredChoice?.consequence || `你真的执行了“${visibleAction}”。${beat.background} 这一步没有自动成功，${actorLabel}已经依据自己的目标作出反应。`,
  }
  if (isCaoCaoWorld(spec)) {
    consequences.investigate = `你压低身形，按“${visibleAction}”查下去。${changedItem ? `${changedItem.name}被重新握到手里，` : ''}董卓的耳目也在同一刻收紧。你得到的每一分先机，都在增加暴露的可能。`
    consequences.talk = `你向${actorLabel}开口，原话没有被替你改写：“${visibleAction}” ${actorLabel}先看你的退路，再看你的眼睛。他只回答自己知道的部分，并把你的异常镇定记在心里。`
    consequences.move = `你立刻执行计划：${visibleAction}。西门的假消息先你一步扩散，你则借暗巷转向${nextBeat.location}。城门的画像没有消失，董卓的人已经开始追查是谁替你传话。`
    consequences.protect = `你先按住局面，执行“${visibleAction}”。刀、印信与前世记忆都还在，但最安全的窗口正在缩小。董卓不会无限期等你回府。`
    consequences.act = authoredChoice?.consequence || `你赌上这一手：“${visibleAction}” ${beat.background} ${actorLabel}没有配合你的剧本，他按自己的欲望留下了另一条后手。`
  } else if (isClassicWorld(spec)) {
    consequences.investigate = `你让军士照“${visibleAction}”逐项查验。${changedItem ? `${changedItem.name}的数量与去向被重新记下。` : ''}周瑜的期限仍在走，江面条件也不会为你停住。`
    consequences.talk = `你当面提出：“${visibleAction}” ${actorLabel}先护住自己的立场才回应。军令、盟友体面与撤退风险因此出现新的冲突。`
    consequences.move = `你执行“${visibleAction}”，船队与人手被带到${nextBeat.location}。原计划的一部分随之失效，新的水路、风向和撤退窗口进入眼前。`
  }
  const reactionText: Record<FallbackIntent, string> = {
    investigate: `${actorLabel}俯身看过痕迹，没有替你宣布胜负。他把自己确认的部分说清，又把不知道的部分留在原处。`,
    talk: `${actorLabel}先守住自己的原则，再回答你的问题。他没有因为你开口就改变立场。`,
    move: `${actorLabel}看见你改变路线，立刻调整自己的下一步，却没有凭空知道你的全部计划。`,
    protect: `${actorLabel}接受了这次暂缓，同时盯住正在流失的时间和代价。`,
    act: `${actorLabel}看见你的动作后作出有限回应，同时保留了与自己目标一致的选择。`,
  }
  const followUps: Record<FallbackIntent, Array<{ id: string; title: string; intent: string }>> = {
    investigate: authoredNextActions,
    talk: authoredNextActions,
    move: nextBeat.choices.map((item) => ({ id: `${item.id}-${turn}`, title: item.title, intent: item.consequence })),
    protect: authoredNextActions,
    act: authoredNextActions,
  }
  return {
    title: beat.title,
    paragraphs: [beat.background, consequences[intent]],
    characterReactions: [{ characterId: actor.id, publicText: reactionText[intent], intent: actor.goal }],
    suggestedActions: followUps[intent].slice(0, 3),
    imagePrompts: [`东方历史互动叙事电影镜头，${spec.title}，${intent === 'move' ? nextBeat.location : beat.location}，玩家行动：${action}，${beat.title}，准确表现行动后果与${actor.id}的反应，人物形象一致，无文字，16:9`],
    newThread: `${beat.prompt} “${visibleAction}”造成的后果仍在扩散。`,
    stateDelta: {
      location: intent === 'move' ? nextBeat.location : beat.location,
      itemChanges: changedItem ? [{ itemId: changedItem.id, status: intent === 'protect' ? '已暂时封存，时机仍在流失' : `已因“${visibleAction.slice(0, 36)}”改变，等待下一幕回收` }] : undefined,
    },
  }
}
