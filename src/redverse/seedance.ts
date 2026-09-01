export type SeedanceTaskStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed'

export interface SeedanceTask {
  id: string
  status: Exclude<SeedanceTaskStatus, 'idle'>
  videoUrl?: string
  error?: string
}

export interface SeedanceDirectorShot {
  title: string
  meaning: string
}

type SeedanceDirectorBrief = {
  worldTitle: string
  conflictFocus: string
  shots: SeedanceDirectorShot[]
}

function compactDirection(text: string, maxLength: number): string {
  const normalized = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  return [...normalized].slice(0, maxLength).join('')
}

/**
 * 把一局游戏的理解路径编译为 Seedance 可执行的导演简报。
 * 只使用去标识化的世界摘要；不发送用户原文、真实姓名或内部状态键。
 */
export function buildSeedanceDirectorPrompt({ worldTitle, conflictFocus, shots }: SeedanceDirectorBrief): string {
  const safeTitle = compactDirection(worldTitle, 28)
  const safeConflict = compactDirection(conflictFocus, 48)
  const usable = shots.length ? shots : [{ title: '进入世界', meaning: '先看清局面，再做选择' }]
  const first = usable[0]
  const middleA = usable[Math.min(1, usable.length - 1)]
  const middleB = usable[Math.max(0, usable.length - 2)]
  const last = usable[usable.length - 1]
  const beat = (shot: SeedanceDirectorShot) => `${compactDirection(shot.title, 24)}：${compactDirection(shot.meaning, 54)}`

  return [
    '生成一支15秒、16:9、24fps的电影感东方寓言短片。单一连续世界，角色轮廓、脸型、发型、服装、关键物件与色彩前后一致，不变形、不漂移、不凭空增减人物。',
    `场景：${safeTitle}。核心冲突：${safeConflict}。深墨蓝、铁灰与克制暗金；体积雾、环境反光、浅景深。`,
    `00:00-00:03｜建立：${beat(first)}。大全景，35mm镜头，摄像机缓慢向左横移；只完成“进入局面”一个动作。`,
    `00:03-00:07｜选择：${beat(middleA)}。中近景，沿同一向左运动方向切入，焦点落在手、眼神或关键物件；呼吸、视线与细微手部动作自然，动作后停顿0.4秒。`,
    `00:07-00:11｜后果：${beat(middleB)}。人物反应与环境变化同帧发生，慢速推近，避免解释性表演；只展示一个可感知后果。`,
    `00:11-00:15｜回响：${beat(last)}。镜头继续向左后轻微拉远，在一个可逆的小行动上落稳，最后0.6秒静止供观众理解。`,
    '声音：低频环境氛围、与物件动作逐帧同步的细小音效、克制弦乐从紧张走向留白；人物呼吸与衣料摩擦自然；无对白，无播音腔旁白。',
    '画面中不要生成文字或字幕；网页会在底部叠加可访问字幕，不要为字幕预留黑色底栏。',
    '避免：真实人脸、真实姓名、水印、文字乱码、跳切、相反方向镜头、服装变化、多人突然增减、夸张游戏特效、快速抖动。',
  ].join('\n')
}

function normalizeTask(value: unknown): SeedanceTask {
  if (!value || typeof value !== 'object') throw new Error('视频服务返回了无法识别的结果')
  const data = value as Record<string, unknown>
  const id = typeof data.id === 'string' ? data.id : typeof data.taskId === 'string' ? data.taskId : ''
  const rawStatus = String(data.status || '').toLowerCase()
  const status: SeedanceTask['status'] = rawStatus === 'succeeded' || rawStatus === 'success' || rawStatus === 'completed'
    ? 'succeeded'
    : rawStatus === 'failed' || rawStatus === 'error' || rawStatus === 'cancelled'
      ? 'failed'
      : rawStatus === 'running' || rawStatus === 'processing'
        ? 'running'
        : 'queued'
  const videoUrl = typeof data.videoUrl === 'string' ? data.videoUrl : typeof data.url === 'string' ? data.url : undefined
  const error = typeof data.error === 'string' ? data.error : undefined
  if (!id) throw new Error('视频任务缺少编号')
  return { id, status, videoUrl, error }
}

async function readJSON(response: Response): Promise<unknown> {
  const value = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = value && typeof value === 'object' && typeof (value as Record<string, unknown>).error === 'string'
      ? String((value as Record<string, unknown>).error)
      : 'Seedance 暂时不可用'
    throw new Error(detail)
  }
  return value
}

export async function createSeedanceTask(prompt: string, signal?: AbortSignal): Promise<SeedanceTask> {
  const response = await fetch('/api/seedance/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal,
  })
  return normalizeTask(await readJSON(response))
}

export async function getSeedanceTask(id: string, signal?: AbortSignal): Promise<SeedanceTask> {
  const response = await fetch(`/api/seedance/tasks/${encodeURIComponent(id)}`, { signal })
  return normalizeTask(await readJSON(response))
}
