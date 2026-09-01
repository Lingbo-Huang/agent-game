import { clues, npcs, WORLD_TITLE } from './content'
import type { PlayerAction, TurnResult, WorldState } from './types'

// ============================================================
// 叙事生成层（Narrator）
// 原则（文档第 12.3 节）：Experience Producer 只能表现已经发生的事情，
// 不能决定世界发生什么——引擎已经算好 WorldDelta/TriggeredEvent，
// Narrator 只负责把它们「写得好看」。
//
// 实现为可插拔 Provider：
//  - RemoteNarrator：调用 /api/narrate（由服务端代理已配置的文本模型）
//  - LocalTemplateNarrator：零网络依赖的本地模板拼装，默认兜底
// 现场无论有没有网络/Key，玩法都不会中断。
// ============================================================

export interface NarratorInput {
  state: WorldState
  action: PlayerAction
  result: TurnResult
  sourceContext?: string
}

export interface Narrator {
  narrate(input: NarratorInput): Promise<string>
  isRemote: boolean
}

function buildSystemPrompt(): string {
  return (
    `你是互动小说《${WORLD_TITLE}》的叙事者。世界规则由程序严格控制，你只负责把已经确定发生的事实，` +
    '写成简体中文的沉浸式旁白，风格具体、克制、有画面感。先写玩家动作，再写立刻可见的结果，然后写角色反应，最后落到下一步问题。' +
    '禁止事项：不要编造程序未提及的新事实、新人物、新地点；不要替角色做违背其原则的举动；' +
    '不要下判断说"这就是真相"，保持留白。每回合写成一段完整的小场景：承接上一刻、呈现行动、写出角色或世界回应、落到一个明确的新问题。' +
    '长度控制在 220-360 字，至少 4 句，不要使用列表或标题，不要复述上一回合已经说过的句子。' +
    '避免 AI 腔：禁用破折号，禁用“不是……而是……”和“并非……而是……”句式，禁用空泛的哲理总结；每句话必须对应一个动作、感官细节、状态变化或可验证问题。'
  )
}

function buildUserPrompt(input: NarratorInput): string {
  const { state, action, result, sourceContext } = input
  const npcNames = Object.values(npcs).map((n) => `${n.name}(${n.role})`).join('、')
  const discovered = result.discoveredClueIds.map((id) => clues[id].name).join('、') || '无'
  const previousNarrations = state.log
    .filter((entry) => entry.kind === 'narration')
    .slice(0, -1)
    .slice(-2)
    .map((entry) => entry.text.replace(/\n/g, ' '))
    .join('\n---\n') || '这是第一回合'
  return [
    `这座隐喻世界来自玩家的现实困惑：${sourceContext || '未提供'}`,
    `当前时间：${state.currentTimeLabel}，天气：${state.weather}`,
    `玩家所在地点：${state.playerLocationId}`,
    `玩家本回合行动类型：${action.type}${action.freeText ? `，玩家原话："${action.freeText}"` : ''}`,
    `程序已结算的事实性结果：${result.narration.replace(/\n/g, ' ')}`,
    `本回合新发现的线索：${discovered}`,
    `是否触发随机事件：${result.triggeredEvent ? result.triggeredEvent.title : '无'}`,
    `当前世界线倾向：${state.activeWorldline}`,
    `世界中的固定人物：${npcNames}`,
    `前两回合已经呈现过的内容（只能承接，禁止照抄）：\n${previousNarrations}`,
    '请基于以上已经确定的事实，写一段连续旁白呈现这一刻。要让玩家看懂这一步为何推进或没有推进目标，并用场景和人物反应表达，不要说教，不要新增程序未提到的情节。',
  ].join('\n')
}

class RemoteNarrator implements Narrator {
  isRemote = true

  async narrate(input: NarratorInput): Promise<string> {
    const resp = await fetch('/api/narrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: buildSystemPrompt(),
        userPrompt: buildUserPrompt(input),
      }),
    })
    if (!resp.ok) throw new Error(`narrate failed: ${resp.status}`)
    const data = (await resp.json()) as { text?: string; error?: string }
    if (!data.text) throw new Error(data.error || 'empty narration')
    return data.text
  }
}

class LocalTemplateNarrator implements Narrator {
  isRemote = false

  async narrate(input: NarratorInput): Promise<string> {
    // 本地模板：直接复用引擎已经写好的、按状态动态拼装的结果文本。
    // 保证零网络依赖、零延迟、演示 100% 稳定。
    const base = input.result.narration.trim()
    if (base.length >= 180) return base
    const discovered = input.result.discoveredClueIds.length
      ? `这一步带来了新的可核验信息：${input.result.discoveredClueIds.map((id) => `「${clues[id].name}」`).join('、')}。`
      : '这一步没有凭空增加证据，却清楚地标出了当前方法的边界。'
    const methodBoundary = input.action.type === 'talk'
      ? '对话没有自动给出真相，但对方愿意说什么、拒绝说什么，也暴露了他的立场与边界。'
      : input.action.type === 'move'
        ? '换一个地点不是绕路：不同地点保存着不同来源的记录，只有让它们彼此核对，才不会被第一种解释困住。'
        : '你现在更清楚这次行动能证明什么、又不能证明什么；没有新证据，也是一条关于方法边界的信息。'
    const consequence = input.state.activeWorldline === 'forgetting'
      ? '与此同时，时间仍在推进；如果继续不改变信息来源，“不了了之”也会成为一种真实后果。'
      : input.state.flags.proof_presented
        ? '接下来真正会改变局面的，不是把话说得更重，而是让一个有责任的第三方复核这些信息。'
        : '下一步可以换一个地点、一个人或一种信息来源，看看同一个判断能否被独立验证。'
    return `${base}\n\n${discovered}${methodBoundary}${consequence}`
  }
}

export function createNarrator(mode: 'remote' | 'local'): Narrator {
  return mode === 'remote' ? new RemoteNarrator() : new LocalTemplateNarrator()
}

/** 优先尝试远程生成，失败自动降级本地模板，调用方无需关心网络状态 */
export class ResilientNarrator implements Narrator {
  isRemote = true
  private remote = new RemoteNarrator()
  private local = new LocalTemplateNarrator()
  private remoteFailedOnce = false

  async narrate(input: NarratorInput): Promise<string> {
    if (this.remoteFailedOnce) return this.local.narrate(input)
    try {
      const text = (await this.remote.narrate(input)).trim()
      const previous = input.state.log
        .filter((entry) => entry.kind === 'narration')
        .slice(0, -1)
        .map((entry) => entry.text.trim())
      const normalize = (value: string) => value.replace(/[\s\p{P}\p{S}]/gu, '')
      const current = normalize(text)
      const isNearDuplicate = previous.some((item) => {
        const prior = normalize(item)
        if (Math.min(current.length, prior.length) < 20) return current === prior
        const shingles = (value: string) => {
          const parts = new Set<string>()
          for (let index = 0; index <= value.length - 10; index += 2) parts.add(value.slice(index, index + 10))
          return parts
        }
        const left = shingles(current)
        const right = shingles(prior)
        let shared = 0
        left.forEach((part) => { if (right.has(part)) shared += 1 })
        return shared / Math.max(1, Math.min(left.size, right.size)) > .48
      })
      if (text.length < 180 || isNearDuplicate) return this.local.narrate(input)
      return text
    } catch {
      this.remoteFailedOnce = true
      return this.local.narrate(input)
    }
  }
}

// ---- 插画生成（可选，用于关键地点首次到达 / 结局卡） ----

const portraitCache = new Map<string, string | undefined>()
const portraitRequests = new Map<string, Promise<string | undefined>>()

export async function generatePortrait(prompt: string, cacheKey: string, retry = false): Promise<string | undefined> {
  if (retry) portraitCache.delete(cacheKey)
  if (portraitCache.has(cacheKey)) return portraitCache.get(cacheKey)
  const pending = portraitRequests.get(cacheKey)
  if (pending) return pending
  const request = (async () => {
    try {
    const resp = await fetch('/api/portrait', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, cacheKey }),
    })
    if (!resp.ok) {
      return undefined
    }
    const data = (await resp.json()) as { image?: string }
    // Only cache a usable image. A transient gateway error must not make this
    // chapter permanently image-less for the rest of the tab session.
    if (data.image) portraitCache.set(cacheKey, data.image)
    return data.image
    } catch {
      return undefined
    } finally {
      portraitRequests.delete(cacheKey)
    }
  })()
  portraitRequests.set(cacheKey, request)
  return request
}
