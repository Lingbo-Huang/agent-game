import type { WorldState } from './types'
import type { CompiledWorld } from './worldCompiler'

const KEY = 'redverse:mirror-session:v1'

export interface MirrorSessionSnapshot {
  schemaVersion: 1
  source: string
  screen: 'game' | 'reflection'
  state: WorldState
  world?: CompiledWorld
}

function isSnapshot(value: unknown): value is MirrorSessionSnapshot {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<MirrorSessionSnapshot>
  return item.schemaVersion === 1
    && typeof item.source === 'string'
    && (item.screen === 'game' || item.screen === 'reflection')
    && Boolean(item.state && typeof item.state.currentTurn === 'number' && Array.isArray(item.state.log))
}

/** 只在当前标签页保存刷新快照；关闭标签页后由浏览器自动清除，不上传用户原文。 */
export function saveMirrorSession(snapshot: Omit<MirrorSessionSnapshot, 'schemaVersion'>): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, ...snapshot }))
  } catch {
    // 隐私模式或存储配额异常时，游戏仍保持可玩。
  }
}

export function loadMirrorSession(): MirrorSessionSnapshot | undefined {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (isSnapshot(parsed)) return parsed
    window.sessionStorage.removeItem(KEY)
  } catch {
    // 无效快照直接忽略，不让恢复能力阻断主流程。
  }
  return undefined
}

export function clearMirrorSession(): void {
  try { window.sessionStorage.removeItem(KEY) } catch { /* no-op */ }
}
