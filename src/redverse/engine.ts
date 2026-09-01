import { clues, eventTemplates, locations, npcs } from './content'
import type {
  CharacterAction,
  ClueId,
  EventTemplate,
  LocationId,
  NpcId,
  PlayerAction,
  QuickAction,
  TurnResult,
  WorldState,
} from './types'
import { getWorldAgentBrief, type CompiledWorld } from './worldCompiler'

// ============================================================
// 世界引擎：负责行动结算、事件选择、世界线判定
// 原则（对应文档第 21 节）：
//  - 随机事件必须有条件，不能凭空发生
//  - 用户行动必须留下持久状态
//  - NPC 有自己的时间，回合推进时也会行动
// ============================================================

const TIME_LABELS = ['21:40', '22:10', '22:45', '23:20', '00:05', '00:50', '01:30', '02:15', '03:00']

function nextTimeLabel(turn: number, world?: CompiledWorld): string {
  const idx = Math.min(turn, TIME_LABELS.length - 1)
  const early: Record<NonNullable<CompiledWorld>['themeId'], string> = { workplace: '庆典夜', relationship: '潮汐夜', decision: '试航夜', growth: '回声夜' }
  const dayPart = turn < 5 ? (world ? early[world.themeId] : '庆典夜') : '深夜'
  return `${dayPart} · ${TIME_LABELS[idx]}`
}

/**
 * 轻量角色 Agent runtime：人格宪法给约束，当前目标和记忆给上下文，
 * 策略只提出候选行动，随后由本函数内的世界权限规则校验并提交。
 * 未来接模型时替换“提出候选”部分即可，提交契约保持不变。
 */
export function proposeCharacterActions(state: WorldState, playerAction: PlayerAction): CharacterAction[] {
  const actions: CharacterAction[] = []
  const partner = state.npcStates.partner
  const witness = state.npcStates.witness
  const captain = state.npcStates.captain

  if (state.flags.proof_presented && captain.currentLocationId === 'captain_room') {
    actions.push({
      npcId: 'captain', kind: 'review', intent: '启动独立复核，而不是立刻站队',
      reason: `${npcs.captain.immutablePrinciples[0]}；玩家已提交可核验的证据链。`,
      fromLocationId: 'captain_room', publicText: '祝舰长把两份记录分开放好，开始逐页标记时间与笔迹。',
      performance: { emotion: 'determined', pose: 'inspect', emphasis: 'strong' },
    })
  }

  if (playerAction.type === 'talk' && playerAction.targetId === 'partner' && (state.actionCounts['talk:partner'] || 0) >= 2) {
    actions.push({
      npcId: 'partner', kind: 'withdraw', intent: '结束重复对质，先保护自己的公开形象',
      reason: `${npcs.partner.motivations[0]}；同一问题已被连续追问。`,
      fromLocationId: partner.currentLocationId, toLocationId: 'chart_room',
      publicText: '沈亦舟扣好外套，没有继续辩解，转身往制图室去了。',
      performance: { emotion: 'guarded', pose: 'leave', emphasis: 'quiet' },
    })
  }

  if (state.currentTurn >= 3 && witness.currentLocationId === 'crow_nest' && state.clues.clue_night_log !== 'hidden') {
    actions.push({
      npcId: 'witness', kind: 'disclose', intent: '把记录留在可被复核的位置',
      reason: `${npcs.witness.immutablePrinciples[0]}；值夜记录已进入玩家视野。`,
      fromLocationId: 'crow_nest', publicText: '阿灯把值夜本翻到对应页，用镇纸压好，但没有替任何人补充动机。',
      performance: { emotion: 'curious', pose: 'write', emphasis: 'normal' },
    })
  }

  return actions
}

function characterActionScore(state: WorldState, playerAction: PlayerAction, action: CharacterAction): number {
  let score = action.performance.emphasis === 'strong' ? 30 : action.performance.emphasis === 'normal' ? 20 : 10
  if (action.npcId === playerAction.targetId) score += 40
  if (action.fromLocationId === state.playerLocationId) score += 15
  if (action.kind === 'review' || action.kind === 'disclose') score += 12
  if (state.npcStates[action.npcId].lastAction?.kind === action.kind) score -= 35
  return score
}

/**
 * Director Agent：所有关键角色都先独立提出候选，再按与本回合的相关性、
 * 戏剧强度和重复度选出最多两个。模型接入后可以并行替换 proposal 阶段，
 * 但导演预算与世界权限校验保持确定性，避免所有角色同时抢戏。
 */
export function runCharacterPulse(state: WorldState, playerAction: PlayerAction): CharacterAction[] {
  const proposals = proposeCharacterActions(state, playerAction)

  // 世界权限校验：一次脉冲至多两个动作；只能去已开放地点；不能凭空新增事实。
  const approved = proposals
    .filter((action) => !action.toLocationId || state.discoveredLocationIds.includes(action.toLocationId))
    .sort((a, b) => characterActionScore(state, playerAction, b) - characterActionScore(state, playerAction, a))
    .slice(0, 2)
  for (const action of approved) {
    const npcState = state.npcStates[action.npcId]
    if (action.toLocationId) npcState.currentLocationId = action.toLocationId
    npcState.emotion = action.performance.emotion
    npcState.lastAction = action
    npcState.recentMemories = [...npcState.recentMemories, `第${state.currentTurn}回合：${action.intent}`].slice(-5)
  }
  state.lastCharacterActions = approved
  return approved
}

function locationById(id: LocationId) {
  const loc = locations.find((l) => l.id === id)
  if (!loc) throw new Error(`未知地点 ${id}`)
  return loc
}

/** 简易自由文本意图解析：把自然语言映射为结构化行动 */
export function interpretFreeText(text: string, state: WorldState): PlayerAction {
  const t = text.trim()
  const clientActionId = `free_${Date.now()}`

  const talkTargets: Array<{ id: NpcId; keys: string[] }> = [
    { id: 'partner', keys: ['沈亦舟', '搭档', '亦舟'] },
    { id: 'witness', keys: ['阿灯', '水手', '值夜'] },
    { id: 'captain', keys: ['舰长', '祝舰长', '船长'] },
  ]
  const moveTargets: Array<{ id: LocationId; keys: string[] }> = [
    { id: 'deck', keys: ['甲板', '庆典'] },
    { id: 'chart_room', keys: ['制图室', '底稿', '航线图'] },
    { id: 'captain_room', keys: ['舰长室'] },
    { id: 'crow_nest', keys: ['瞭望台', '值夜台'] },
  ]

  if (/等待|再等一会|观望|按兵不动/.test(t)) {
    return { clientActionId, type: 'wait', freeText: text }
  }
  for (const target of talkTargets) {
    if (target.keys.some((k) => t.includes(k)) && /(说|问|谈|聊|质问|对质|告诉)/.test(t)) {
      return { clientActionId, type: 'talk', targetId: target.id, freeText: text }
    }
  }
  for (const target of moveTargets) {
    if (target.keys.some((k) => t.includes(k)) && (/(去|回到|前往|走到)/.test(t) || !/(说|问|谈|看|查)/.test(t))) {
      return { clientActionId, type: 'move', targetId: target.id, freeText: text }
    }
  }
  if (/(查|调查|翻|检查|搜)/.test(t)) {
    return { clientActionId, type: 'investigate', targetId: state.playerLocationId, freeText: text }
  }
  if (/(看|观察|留意|注意)/.test(t)) {
    return { clientActionId, type: 'observe', targetId: state.playerLocationId, freeText: text }
  }
  // 默认当作观察当前地点处理，保证"没有空回合"
  return { clientActionId, type: 'observe', targetId: state.playerLocationId, freeText: text }
}

function cloneState(state: WorldState): WorldState {
  return JSON.parse(JSON.stringify(state))
}

function contextualize(text: string, world?: CompiledWorld): string {
  if (!world || world.themeId === 'workplace') return text
  const replacements: Array<[string, string]> = [
    ['祝舰长', world.lexicon.captainName], ['沈亦舟', world.lexicon.partnerName], ['阿灯', world.lexicon.witnessName],
    ['完整的证据链', world.clueCopy.clue_combined_proof.name], ['证据链', world.clueCopy.clue_combined_proof.name],
    ['底稿上的两种笔迹', world.clueCopy.clue_draft_map.name], ['袖口的墨渍', world.clueCopy.clue_ink_smudge.name],
    ['值夜记录本', world.lexicon.record], ['值夜记录', world.lexicon.record], ['值夜本', world.lexicon.record],
    ['最后一版航线', world.lexicon.artifact], ['航线底稿', world.lexicon.artifact], ['底稿', world.lexicon.artifact],
    ['制图室', world.locationCopy.chart_room.shortName], ['瞭望台', world.locationCopy.crow_nest.shortName], ['舰长室', world.locationCopy.captain_room.shortName],
    ['庆典甲板', world.locationCopy.deck.name], ['甲板', world.locationCopy.deck.shortName],
    ['记功记录', world.lexicon.process], ['记功', world.lexicon.process], ['舰长', world.lexicon.captainName],
  ]
  return Object.values(clues).reduce((copy, clue) => copy.replaceAll(clue.name, world.clueCopy[clue.id].name), replacements.reduce((copy, [from, to]) => copy.replaceAll(from, to), text))
}

function contextualTalk(world: CompiledWorld | undefined, npcId: NpcId, repeated: number): string | undefined {
  if (!world || world.themeId === 'workplace') return undefined
  const actor = getWorldAgentBrief(world, npcId)
  if (npcId === 'partner') {
    if (repeated === 0) return `你没有顺着${actor.name}的催促立刻下结论，而是请他说明自己真正想保护的东西。${actor.name}停顿片刻，没有替你决定，只守住自己的原则：“${actor.principle}。” 你第一次看见，他当前真正想做的是${actor.goal}。`
    if (repeated === 1) return `你把问题缩小到一件可以核对的事，不再要求${actor.name}一次解释全部。${actor.name}给出了一部分具体信息，也明确说出自己无法替你承担的代价。立场没有被你改写，但讨论从互相拉扯变成了可以验证的问题。`
    return `${actor.name}没有再补充新的事实，只重复了自己的边界。继续用相同问法不会产生新信息；你需要换一个信息来源，或去${world.locationCopy.chart_room.shortName}核对${world.lexicon.artifact}。`
  }
  if (npcId === 'witness') {
    if (repeated === 0) return `${actor.name}先把观察和猜测分开：“我只说自己能够确认的部分。” ${actor.principle}。这份克制没有直接给你答案，却让接下来的信息更可信。`
    if (repeated === 1) return `这一次你只请${actor.name}核对${world.lexicon.record}中的一个具体节点。她指出记录支持什么，也主动标出它不能预测什么。有限的信息因此比笼统的保证更有用。`
    return `${actor.name}没有因为你再次追问就改变记录：“同一份信息不会多问一次就变得更确定。” 她提醒你保留未知，并寻找另一个独立来源。`
  }
  if (repeated === 0) return `${actor.name}让你把话说完，然后复述了${world.lexicon.process}的标准：“${actor.principle}。” 他没有否定你的感受，也没有用安慰代替判断，而是说清下一步需要哪些可复核信息。`
  return `${actor.name}没有改变标准：“重复表达不会增加事实的重量。” 他请你带来${world.lexicon.artifact}、${world.lexicon.record}，或一份边界清楚的小试验，再继续${world.lexicon.process}。`
}

function actionKey(action: PlayerAction, locationId: LocationId): string {
  return `${action.type}:${action.targetId || locationId}`
}

function repeatCount(state: WorldState, action: PlayerAction): number {
  return state.actionCounts[actionKey(action, state.playerLocationId)] || 0
}

function checkClueUnlocks(state: WorldState): ClueId[] {
  const unlocked: ClueId[] = []
  for (const clue of Object.values(clues)) {
    if (state.clues[clue.id] !== 'hidden') continue
    if (clue.requiresClueIds) {
      const ok = clue.requiresClueIds.every((id) => state.clues[id] === 'discovered' || state.clues[id] === 'connected')
      if (ok) unlocked.push(clue.id)
      continue
    }
    if (clue.requiresTrust) {
      const npcState = state.npcStates[clue.requiresTrust.npc]
      if (npcState.trust >= clue.requiresTrust.min) unlocked.push(clue.id)
    }
  }
  return unlocked
}

function checkLocationUnlocks(state: WorldState): LocationId[] {
  const unlocked: LocationId[] = []
  for (const loc of locations) {
    if (state.discoveredLocationIds.includes(loc.id)) continue
    if (loc.unlockCondition && loc.unlockCondition(state)) unlocked.push(loc.id)
  }
  return unlocked
}

function selectEvent(state: WorldState, currentLocationId: LocationId): EventTemplate | undefined {
  const candidates = eventTemplates.filter((tpl) => {
    if (state.triggeredEventIds.includes(tpl.id) && tpl.cooldownTurns >= 99) return false
    const lastTurn = state.lastEventTurnByCategory[tpl.category] ?? -999
    if (state.currentTurn - lastTurn < tpl.cooldownTurns) return false
    if (tpl.locationIds && !tpl.locationIds.includes(currentLocationId)) return false
    if (tpl.requiredClueIds && !tpl.requiredClueIds.every((id) => state.clues[id] !== 'hidden')) return false
    if (tpl.excludedFlags && tpl.excludedFlags.some((f) => state.flags[f])) return false
    if (tpl.requiredFlags && !tpl.requiredFlags.every((f) => state.flags[f])) return false
    if (tpl.customCondition && !tpl.customCondition(state)) return false
    return true
  })

  if (candidates.length === 0) return undefined

  // 世界可以施加时间压力，但不会仅因为回合数替玩家决定结局。
  // “默认翻篇”只在玩家明确接受后进入候选池。
  const weighted = candidates.map((tpl) => {
    const weight = tpl.baseWeight
    return { tpl, weight }
  })

  const total = weighted.reduce((sum, w) => sum + w.weight, 0)
  let roll = Math.random() * total
  for (const w of weighted) {
    roll -= w.weight
    if (roll <= 0) return w.tpl
  }
  return weighted[weighted.length - 1].tpl
}

interface ResolveContext {
  state: WorldState
  action: PlayerAction
  world?: CompiledWorld
}

function resolveMove(ctx: ResolveContext): { narration: string } {
  const { state, action } = ctx
  const targetId = action.targetId as LocationId | undefined
  if (!targetId || !state.discoveredLocationIds.includes(targetId)) {
    return { narration: '这个地方现在还去不了。也许需要先找到通往那里的线索。' }
  }
  const loc = locationById(targetId)
  const from = locationById(state.playerLocationId)
  state.playerLocationId = targetId
  return { narration: `你离开${from.shortName}，沿着船舷走了约 ${loc.travelMinutes} 分钟。${loc.description} 海风把身后的喧闹压低了，这里显然藏着另一部分答案。` }
}

function resolveObserve(ctx: ResolveContext): { narration: string; discovered: ClueId[] } {
  const { state, action } = ctx
  const repeated = repeatCount(state, action)
  const loc = locationById(state.playerLocationId)
  const discovered: ClueId[] = []
  for (const clueId of loc.discoverableClueIds) {
    if (state.clues[clueId] === 'hidden') {
      state.clues[clueId] = 'hinted'
    }
  }
  const hinted = loc.discoverableClueIds.filter((id) => state.clues[id] === 'hinted')
  const npcsHere = loc.residentNpcIds
    .map((id) => state.npcStates[id])
    .filter((n) => n.currentLocationId === state.playerLocationId)

  let narration = repeated === 0
    ? `你没有急着行动，而是让目光在${loc.name}停留得更久。${loc.ambientHintOpen}`
    : `你换了一个角度重新观察${loc.name}。第一次被情绪盖住的细节慢慢浮了出来，但相同的凝视已经不会再凭空产生答案。`
  if (hinted.length > 0) {
    narration += ` 你注意到似乎有些不对劲的细节，值得再深入调查一下。`
  }
  if (npcsHere.length > 0) {
    narration += ` ${npcsHere.map((n) => npcs[n.npcId].name).join('、')}也在这里。`
  }
  narration += repeated > 0 ? ' 若想让局面继续变化，你需要调查具体物件，或向某个人提出更明确的问题。' : ' 你意识到，观察只能提出问题，下一步还需要验证。'
  return { narration, discovered }
}

function resolveInvestigate(ctx: ResolveContext): { narration: string; discovered: ClueId[] } {
  const { state, action } = ctx
  const repeated = repeatCount(state, action)
  const loc = locationById(state.playerLocationId)
  const discovered: ClueId[] = []
  for (const clueId of loc.discoverableClueIds) {
    if (state.clues[clueId] === 'hidden' || state.clues[clueId] === 'hinted') {
      state.clues[clueId] = 'discovered'
      discovered.push(clueId)
    }
  }
  if (discovered.length === 0) {
    const alternatives = repeated > 0
      ? '你把抽屉、桌角与旧记录逐一复查，留下的痕迹与上一次完全一致。继续翻找只会重复自己的猜测；证据已经在催你换一个地点，或找当事人核对。'
      : '你把能检查的地方认真找了一遍，没有新的物证出现。没有发现本身也是信息：答案可能掌握在别处，或藏在某个人不愿主动说出的那部分里。'
    return { narration: `${loc.name}很安静。${alternatives}`, discovered }
  }
  const texts = discovered.map((id) => `发现线索「${clues[id].name}」：${clues[id].revealsText}`)
  return { narration: `你顺着刚才注意到的异常继续追查，终于让模糊的感觉落到了可以核对的东西上。${texts.join(' ')} 这条线索没有替你解释动机，却让“谁做了什么”不再只能靠争辩。`, discovered }
}

function resolveTalk(ctx: ResolveContext): { narration: string; discovered: ClueId[] } {
  const { state, action, world } = ctx
  const npcId = action.targetId as NpcId | undefined
  const discovered: ClueId[] = []
  if (!npcId || !npcs[npcId]) {
    return { narration: '这里现在没有可以交谈的人。', discovered }
  }
  const npcState = state.npcStates[npcId]
  const repeated = repeatCount(state, action)
  if (npcState.currentLocationId !== state.playerLocationId) {
    return { narration: `${npcs[npcId].name}现在不在这里。`, discovered }
  }

  npcState.hasMetPlayer = true
  npcState.trust = Math.min(100, npcState.trust + (repeated === 0 ? 12 : repeated === 1 ? 7 : 3))

  let narration = ''
  const compiledNarration = contextualTalk(world, npcId, repeated)
  if (compiledNarration) narration = compiledNarration
  else if (npcId === 'partner') {
    state.flags.confronted_partner = true
    narration = repeated === 0
      ? '你没有在众人面前发难，而是把沈亦舟叫到灯影外。沈亦舟避开你的视线："这件事……不是我一个人能决定怎么说的。" 他没有承认，却也没有否认那份不安。你看清了他的边界：名声受到威胁时，他会先保护自己。'
      : repeated === 1
        ? '你把问题收窄，只问他最后一版航线是谁改的。沈亦舟沉默片刻："有些修正当然不是我一个人做的，但现在翻出来，对谁都不好看。" 这不是道歉，却第一次承认了“共同完成”的事实。他仍然拒绝公开承担后果。'
        : '你再次追问，沈亦舟不再补充解释，只说："我能说的已经说了。" 他的防线已经合上。继续施压不会产生新事实，只会让他把你当作必须防御的人。'
  } else if (npcId === 'witness') {
    narration = repeated === 0
      ? '阿灯先看了一眼四周，才让你靠近灯笼。"我能说的，只有我亲眼看到的部分。你要是真想弄清楚，得自己去找证据。" 他不是不愿帮你，而是不肯把猜测伪装成证词。'
      : repeated === 1
        ? '这一次你没有要求阿灯替你证明全部，只请他确认值夜时亲眼看见的时间。阿灯的肩膀松下来一些，指尖点向摊开的记录本："写下来的，我可以负责。没看见的，我一句也不会添。" 有限的证词因此变得更可信。'
        : '阿灯把灯芯拨亮，却没有再讲新的版本。"记录不会因为多问一次就改变。" 他提醒你把已知与未知分开，然后把视线落回值夜本。'
  } else if (npcId === 'captain') {
    narration = state.clues.clue_combined_proof !== 'hidden'
      ? '你把底稿与值夜记录并排放在桌上，没有夸大，也没有替沈亦舟猜动机。祝舰长逐页核对后说："这足以让我重开记功记录，但我还会分别听取你们的说明。" 她接受的是证据链，不是情绪更响亮的一方。局面第一次真正向前移动。'
      : repeated === 0
        ? '祝舰长让你把话说完，语气始终平静："我理解你的感受，但记功的事，我只看证据，不看谁更委屈。" 她没有否定你，却拒绝用同情代替核实。桌面上留出的空位，像是在等一份能被检验的材料。'
        : '你再次说明感受，祝舰长仍没有改变标准："重复陈述不会增加事实的重量。带来底稿、记录，或可以承担责任的证人。" 她的原则没有被你改写，但她把可行的下一步说得更清楚了。'
    if (state.clues.clue_combined_proof !== 'hidden') {
      state.flags.proof_presented = true
      state.flags.ending_reached = true
      state.flags.ending_kind = 'truth'
      state.flags.worldline_pushed = true
      state.activeWorldline = 'truth'
      state.cityStability = Math.max(state.cityStability, 75)
    }
  }

  // 信任达标后解锁关系线索
  for (const clueId of checkClueUnlocks(state)) {
    if (clues[clueId].relatedNpcIds.includes(npcId) && state.clues[clueId] === 'hidden') {
      state.clues[clueId] = 'discovered'
      discovered.push(clueId)
      narration += ` ${clues[clueId].revealsText}`
    }
  }

  return { narration, discovered }
}

function resolveUse(ctx: ResolveContext): { narration: string; discovered: ClueId[] } {
  const { state, action } = ctx
  const discovered: ClueId[] = []
  if (action.targetId === 'clue_combined_proof' || action.freeText?.includes('证据') || action.freeText?.includes('底稿')) {
    if (state.clues.clue_combined_proof === 'hidden') {
      const unlocked = checkClueUnlocks(state).includes('clue_combined_proof')
      if (unlocked) {
        state.clues.clue_combined_proof = 'connected'
        discovered.push('clue_combined_proof')
        return { narration: `你没有把每条线索单独夸大，而是检查它们能否彼此独立地指向同一件事。底稿说明关键修正出自谁手，值夜记录说明谁在什么时间进入制图室。${clues.clue_combined_proof.revealsText} 现在，你拥有的不是更强烈的确信，而是一条别人也能复核的证据链。`, discovered }
      }
      return { narration: '你手上的证据还不足以拼成完整的证据链，需要再找找。', discovered }
    }
    // 已经拼合过：给出明确反馈而不是重复"证据不足"
    return { narration: '证据链你已经整理好了，是时候拿去找舰长当面说清楚了。', discovered }
  }
  return { narration: '这里暂时没有可以使用的东西。', discovered }
}

function resolveWait(ctx: ResolveContext): { narration: string } {
  if (ctx.action.targetId === 'accept-forgetting') {
    // 这是玩家明确点击的结局动作，不能再交给随机事件抽选；否则按钮
    // 虽然出现，结算却可能被同回合的环境事件抢走。
    ctx.state.activeWorldline = 'forgetting'
    ctx.state.cityStability -= 15
    Object.assign(ctx.state.flags, {
      accepted_forgetting: true,
      worldline_pushed: true,
      ending_reached: true,
      ending_kind: 'forgetting',
    })
    return { narration: '你决定不再继续追查。这个选择保护了当下的平静，也意味着尚未进入复核流程的信息会随着庆典散去。' }
  }
  const repeated = repeatCount(ctx.state, ctx.action)
  const text = repeated === 0
    ? '你没有立刻行动，只是靠在栏杆边，让脑子里的念头再转一会儿。钟声越过海面，船员们仍在换岗，世界并不会因为你犹豫而停下。等待给了你喘息，也把一部分主动权交给了别人。'
    : '你又等了一会儿。庆典的人声变得更远，灯笼也熄了几盏；没有人主动替你澄清事实。第二次等待不再只是整理情绪，它正在让“就这样算了”成为默认结局。'
  return { narration: text }
}

export function resolveTurn(prevState: WorldState, action: PlayerAction, world?: CompiledWorld): { state: WorldState; result: TurnResult } {
  const state = cloneState(prevState)
  state.actionCounts ||= {}
  state.recentActionKeys ||= []
  state.processedActionIds ||= []
  if (state.processedActionIds.includes(action.clientActionId)) {
    return {
      state,
      result: {
        narration: '',
        discoveredClueIds: [],
        unlockedLocationIds: [],
        worldlineChanged: false,
        characterActions: [],
      },
    }
  }
  state.processedActionIds = [...state.processedActionIds, action.clientActionId].slice(-100)
  state.currentTurn += 1
  state.currentTimeLabel = nextTimeLabel(state.currentTurn, world)

  let narration = ''
  let discovered: ClueId[] = []

  switch (action.type) {
    case 'move': {
      const r = resolveMove({ state, action })
      narration = r.narration
      break
    }
    case 'observe': {
      const r = resolveObserve({ state, action })
      narration = r.narration
      discovered = r.discovered
      break
    }
    case 'investigate': {
      const r = resolveInvestigate({ state, action })
      narration = r.narration
      discovered = r.discovered
      break
    }
    case 'talk': {
      const r = resolveTalk({ state, action, world })
      narration = r.narration
      discovered = r.discovered
      break
    }
    case 'use': {
      const r = resolveUse({ state, action })
      narration = r.narration
      discovered = r.discovered
      break
    }
    case 'wait': {
      const r = resolveWait({ state, action })
      narration = r.narration
      break
    }
  }

  // 两份独立线索齐全只表示“可以组合”，不能替玩家自动完成关键推理。
  // 对应的显式 use 行动会由 getAvailableQuickActions 立即给出。

  const unlockedLocations = checkLocationUnlocks(state)
  unlockedLocations.forEach((id) => state.discoveredLocationIds.push(id))

  // 事件引擎
  const event = selectEvent(state, state.playerLocationId)
  let eventNarration = ''
  let worldlineChanged = false
  if (event) {
    const before = state.activeWorldline
    const patch = event.effects(state)
    const { flagsPatch, ...rest } = patch
    Object.assign(state, rest)
    if (flagsPatch) Object.assign(state.flags, flagsPatch)
    state.triggeredEventIds.push(event.id)
    state.lastEventTurnByCategory[event.category] = state.currentTurn
    eventNarration = event.narrationTemplate
    worldlineChanged = before !== state.activeWorldline
  }

  const fullNarration = eventNarration ? `${narration}\n\n【事件】${eventNarration}` : narration

  const resolvedActionKey = actionKey(action, prevState.playerLocationId)
  state.actionCounts[resolvedActionKey] = (state.actionCounts[resolvedActionKey] || 0) + 1
  state.recentActionKeys = [...state.recentActionKeys, resolvedActionKey].slice(-5)

  const characterActions = runCharacterPulse(state, action)
  const contextualActions = characterActions.map((item) => ({
    ...item,
    intent: contextualize(item.intent, world),
    reason: contextualize(item.reason, world),
    publicText: contextualize(item.publicText, world),
  }))
  state.lastCharacterActions = contextualActions
  for (const item of contextualActions) state.npcStates[item.npcId].lastAction = item
  const contextualCharacterNarration = contextualActions.length
    ? `\n\n【角色行动】${contextualActions.map((item) => item.publicText).join(' ')}`
    : ''
  const committedNarration = contextualize(`${fullNarration}${contextualCharacterNarration}`, world)

  state.log.push({ turn: state.currentTurn, timeLabel: state.currentTimeLabel, kind: 'narration', text: committedNarration })
  if (event) {
    state.log.push({ turn: state.currentTurn, timeLabel: state.currentTimeLabel, kind: 'event', text: `${event.title}` })
  }

  const result: TurnResult = {
    narration: committedNarration,
    triggeredEvent: event,
    discoveredClueIds: discovered,
    unlockedLocationIds: unlockedLocations,
    worldlineChanged,
    characterActions: contextualActions,
  }

  return { state, result }
}

export function getAvailableQuickActions(state: WorldState, world?: CompiledWorld): { location: ReturnType<typeof locationById>; npcsHere: NpcId[]; actions: QuickAction[] } {
  const loc = locationById(state.playerLocationId)
  const npcsHere = loc.residentNpcIds.filter((id) => state.npcStates[id].currentLocationId === state.playerLocationId)
  const actions: QuickAction[] = []

  // 结局是一次明确的结算，不再继续伪装成仍需找出口的普通回合。
  // 玩家可以从 UI 进入回响页，或返回重玩另一条路径。
  if (state.flags.ending_reached) return { location: loc, npcsHere, actions }

  if (state.currentTurn >= 12 && state.activeWorldline === 'undetermined') {
    actions.push({ id: 'accept-forgetting', type: 'wait', targetId: 'accept-forgetting', icon: '○', label: '接受翻篇，结束这次追查', hint: '主动结束；未核实的信息不会自动变成事实' })
  }

  const observeKey = `observe:${loc.id}`
  const investigateKey = `investigate:${loc.id}`
  const localClues = loc.discoverableClueIds.map((id) => state.clues[id])

  if (localClues.some((status) => status === 'hidden')) {
    actions.push({ id: observeKey, type: 'observe', targetId: loc.id, icon: '◌', label: loc.id === 'deck' ? world?.actionCopy.observe || '留意搭档的反应' : '先观察现场', hint: '先提出问题，不急着下结论' })
  }
  if (localClues.some((status) => status === 'hinted' || status === 'hidden')) {
    actions.push({ id: investigateKey, type: 'investigate', targetId: loc.id, icon: '⌕', label: loc.id === 'chart_room' ? `核对${world?.lexicon.artifact || '最后一版底稿'}` : loc.id === 'crow_nest' ? `翻看${world?.lexicon.record || '值夜记录'}` : world?.actionCopy.investigate || '检查异常细节', hint: '把感觉变成可验证的信息', tone: 'important' })
  }

  for (const npcId of npcsHere) {
    const count = state.actionCounts[`talk:${npcId}`] || 0
    if (count >= 3) continue
    const labels: Record<NpcId, string[]> = world ? {
      partner: world.actionCopy.partnerTalk,
      witness: world.actionCopy.witnessTalk,
      captain: state.clues.clue_combined_proof !== 'hidden'
        ? [`把完整方案交给${world.lexicon.captainName}`, `请${world.lexicon.captainName}说明${world.lexicon.process}`, '确认下一步如何分别核实']
        : world.actionCopy.captainTalk,
    } : {
      partner: ['私下问沈亦舟发生了什么', '只核对最后一版由谁修改', '指出他前后说法的边界'],
      witness: ['询问阿灯亲眼看见什么', '请阿灯只确认记录时间', '确认哪些部分他并不知道'],
      captain: state.clues.clue_combined_proof !== 'hidden'
        ? ['把完整证据链交给舰长', '请舰长说明复核流程', '确认下一步如何分别核实']
        : ['询问舰长需要什么证据', '只陈述可确认的贡献事实', '确认记功复核的标准'],
    }
    actions.push({ id: `talk:${npcId}`, type: 'talk', targetId: npcId, icon: npcs[npcId].portraitSymbol, label: labels[npcId][Math.min(count, 2)], hint: count === 0 ? '听见一个有自身立场的视角' : '问题更具体，回答也会变化', tone: npcId === 'captain' && state.clues.clue_combined_proof !== 'hidden' ? 'important' : 'normal' })
  }

  if (state.clues.clue_draft_map === 'discovered' && state.clues.clue_night_log === 'discovered' && state.clues.clue_combined_proof === 'hidden') {
    actions.unshift({ id: 'use:clue_combined_proof', type: 'use', targetId: 'clue_combined_proof', icon: '◇', label: world?.actionCopy.combine || '把两条线索拼成证据链', hint: '检查独立信息能否互相印证', tone: 'important' })
  }

  if (state.clues.clue_combined_proof !== 'hidden' && !state.flags.ending_reached && loc.id !== 'captain_room') {
    actions.unshift({ id: 'move:captain_room', type: 'move', targetId: 'captain_room', icon: '↗', label: `前往${world?.locationCopy.captain_room.shortName || '舰长室'}提交复核`, hint: `结局最后一步：把证据交给${world?.lexicon.captainName || '舰长'}`, tone: 'important' })
  }

  const destinations = locations.filter((item) => item.id !== loc.id && state.discoveredLocationIds.includes(item.id))
  const recommended = destinations.find((item) => item.discoverableClueIds.some((id) => state.clues[id] === 'hidden' || state.clues[id] === 'hinted')) || destinations[0]
  if (recommended && !actions.some((action) => action.type === 'move' && action.targetId === recommended.id)) actions.push({ id: `move:${recommended.id}`, type: 'move', targetId: recommended.id, icon: '↗', label: `前往${world?.locationCopy[recommended.id].shortName || recommended.shortName}`, hint: world?.locationCopy[recommended.id].description || recommended.ambientHintOpen })

  if (!actions.length || state.currentTurn >= 7) actions.push({ id: 'wait', type: 'wait', icon: '◷', label: '让时间继续推进', hint: '世界中的人会继续行动' })
  return { location: loc, npcsHere, actions: actions.slice(0, 4) }
}
