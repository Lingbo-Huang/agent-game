export interface ReelShot {
  title: string
  visual: string
  subtitle: string
  meaning: string
}

type RenderOptions = {
  title: string
  shots: ReelShot[]
  durationPerShotMs?: number
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const character of text) {
    const candidate = current + character
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = character
    } else current = candidate
  }
  if (current) lines.push(current)
  return lines.slice(0, 4)
}

function drawFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  shot: ReelShot,
  shotIndex: number,
  shotCount: number,
  progress: number,
) {
  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#071019')
  gradient.addColorStop(.52, '#17323b')
  gradient.addColorStop(1, '#0b151d')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)

  context.save()
  context.globalAlpha = .18
  context.fillStyle = '#d6ad68'
  context.beginPath()
  context.arc(width * (.78 - progress * .03), height * .22, 96, 0, Math.PI * 2)
  context.fill()
  context.restore()

  context.fillStyle = 'rgba(214,173,104,.72)'
  context.fillRect(72, 82, 4, 102)
  context.font = '500 25px serif'
  context.fillText('回响引擎 EchoForge · 本局回响短片', 98, 106)
  context.fillStyle = '#82989e'
  context.font = '20px sans-serif'
  context.fillText(`${shotIndex + 1} / ${shotCount}`, width - 150, 106)

  context.fillStyle = '#f1cd87'
  context.font = '500 52px serif'
  context.fillText(shot.title, 92, 245)
  context.fillStyle = '#9db0b1'
  context.font = '26px serif'
  wrapText(context, shot.visual, width - 184).forEach((line, index) => context.fillText(line, 92, 305 + index * 42))

  const subtitleY = height - 245
  context.fillStyle = 'rgba(4,9,13,.7)'
  context.fillRect(60, subtitleY - 44, width - 120, 166)
  context.fillStyle = '#f6f1e5'
  context.font = '600 31px serif'
  const subtitleLines = wrapText(context, shot.subtitle, width - 190)
  subtitleLines.forEach((line, index) => context.fillText(line, 92, subtitleY + index * 44))
  context.fillStyle = '#d6ad68'
  context.font = '20px sans-serif'
  context.fillText(`这一幕留下：${shot.meaning}`, 92, height - 76)

  context.fillStyle = 'rgba(255,255,255,.14)'
  context.fillRect(92, height - 37, width - 184, 3)
  context.fillStyle = '#d6ad68'
  context.fillRect(92, height - 37, (width - 184) * ((shotIndex + progress) / shotCount), 3)
  context.fillStyle = 'rgba(237,240,232,.5)'
  context.font = '16px sans-serif'
  context.fillText(title, 92, 62)
}

/**
 * 用浏览器 Canvas + MediaRecorder 把已确定的分镜合成为 WebM。
 * 它不调用生成模型，也不会把用户内容上传到服务端。
 */
export async function renderReelVideo({ title, shots, durationPerShotMs = 2200 }: RenderOptions): Promise<Blob> {
  if (!shots.length) throw new Error('没有可渲染的分镜')
  if (typeof MediaRecorder === 'undefined') throw new Error('当前浏览器不支持视频导出')
  const canvas = document.createElement('canvas')
  canvas.width = 960
  canvas.height = 540
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建视频画布')
  const stream = canvas.captureStream(30)
  const supportedType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((type) => MediaRecorder.isTypeSupported(type)) || ''
  const recorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
  const completed = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('视频编码失败'))
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }))
  })
  recorder.start(250)
  const frameMs = 1000 / 30
  for (let shotIndex = 0; shotIndex < shots.length; shotIndex += 1) {
    const startedAt = performance.now()
    while (performance.now() - startedAt < durationPerShotMs) {
      const progress = Math.min(1, (performance.now() - startedAt) / durationPerShotMs)
      drawFrame(context, canvas.width, canvas.height, title, shots[shotIndex], shotIndex, shots.length, progress)
      await new Promise<void>((resolve) => window.setTimeout(resolve, frameMs))
    }
  }
  recorder.stop()
  stream.getTracks().forEach((track) => track.stop())
  return completed
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
