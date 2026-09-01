import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { evaluateGuardPose, UPPER_BODY_CONNECTIONS } from './poseChallenge'

type ChallengeState = 'intro' | 'loading' | 'detecting' | 'success' | 'timeout' | 'error'
export type PhysicalChallengeOutcome = 'guarded' | 'missed' | 'fallback'

interface MotionChallengeProps {
  onClose: () => void
  onComplete: (outcome: PhysicalChallengeOutcome) => void
}

const DETECTION_WINDOW_MS = 10_000
const REQUIRED_STABLE_FRAMES = 6

function drawSkeleton(canvas: HTMLCanvasElement, points: NormalizedLandmark[]) {
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.translate(canvas.width, 0)
  context.scale(-1, 1)
  context.lineWidth = 4
  context.lineCap = 'round'
  context.strokeStyle = 'rgba(153, 238, 214, .9)'
  for (const [from, to] of UPPER_BODY_CONNECTIONS) {
    const a = points[from]
    const b = points[to]
    if (!a || !b || (a.visibility ?? 0) < .45 || (b.visibility ?? 0) < .45) continue
    context.beginPath()
    context.moveTo(a.x * canvas.width, a.y * canvas.height)
    context.lineTo(b.x * canvas.width, b.y * canvas.height)
    context.stroke()
  }
  for (const index of [11, 12, 13, 14, 15, 16]) {
    const point = points[index]
    if (!point || (point.visibility ?? 0) < .45) continue
    context.beginPath()
    context.fillStyle = index >= 15 ? '#e7b96c' : '#d8f2ea'
    context.arc(point.x * canvas.width, point.y * canvas.height, index >= 15 ? 8 : 6, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}

export function MotionChallenge({ onClose, onComplete }: MotionChallengeProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const frameRef = useRef<number | null>(null)
  const stableFramesRef = useRef(0)
  const finishedRef = useRef(false)
  const [state, setState] = useState<ChallengeState>('intro')
  const [remaining, setRemaining] = useState(10)
  const [score, setScore] = useState(0)
  const [message, setMessage] = useState('不需要任何道具。摄像头画面只在本机提取骨骼关键点，不上传、不录像。')

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => {
    stopCamera()
    landmarkerRef.current?.close()
  }, [stopCamera])

  const finish = useCallback((outcome: PhysicalChallengeOutcome) => {
    if (finishedRef.current) return
    finishedRef.current = true
    stopCamera()
    setState(outcome === 'missed' ? 'timeout' : 'success')
    if (outcome === 'guarded') {
      setScore(100)
      setMessage('架挡成功。关羽接住第一击，张飞已经从侧翼逼近。')
    } else if (outcome === 'missed') {
      setMessage('你慢了半拍。关羽替你卸开锋芒，队伍的协作方式因此改变。失败不会卡死剧情。')
    } else {
      setMessage('已使用键盘降级完成演示；正式现场优先使用骨骼识别。')
    }
    window.setTimeout(() => onComplete(outcome), 900)
  }, [onComplete, stopCamera])

  const detect = useCallback((startedAt: number) => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current
    if (!video || !canvas || !landmarker || finishedRef.current) return
    const now = performance.now()
    const result = landmarker.detectForVideo(video, now)
    const points = result.landmarks[0]
    if (points) {
      drawSkeleton(canvas, points)
      const evaluation = evaluateGuardPose(points)
      setScore(evaluation.score)
      setMessage(evaluation.hint)
      stableFramesRef.current = evaluation.matched ? stableFramesRef.current + 1 : 0
      if (stableFramesRef.current >= REQUIRED_STABLE_FRAMES) {
        finish('guarded')
        return
      }
    } else {
      stableFramesRef.current = 0
      setScore(0)
      setMessage('正在寻找上半身，请站到画面中央并后退半步')
    }

    const elapsed = now - startedAt
    setRemaining(Math.max(0, Math.ceil((DETECTION_WINDOW_MS - elapsed) / 1000)))
    if (elapsed >= DETECTION_WINDOW_MS) {
      finish('missed')
      return
    }
    frameRef.current = requestAnimationFrame(() => detect(startedAt))
  }, [finish])

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setMessage('当前浏览器没有摄像头接口。可以按 Space 验证剧情降级路径。')
      return
    }
    finishedRef.current = false
    stableFramesRef.current = 0
    setState('loading')
    setRemaining(10)
    setScore(0)
    setMessage('正在本地加载 MediaPipe Pose 骨骼模型…')
    try {
      if (!landmarkerRef.current) {
        const fileset = await FilesetResolver.forVisionTasks('/mediapipe')
        const options = (delegate: 'GPU' | 'CPU') => ({
          baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate },
          runningMode: 'VIDEO' as const, numPoses: 1,
          minPoseDetectionConfidence: .55, minPosePresenceConfidence: .55, minTrackingConfidence: .55,
        })
        try {
          landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, options('GPU'))
        } catch {
          setMessage('显卡加速不可用，正在切换兼容模式…')
          landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, options('CPU'))
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 720, facingMode: 'user' }, audio: false })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('video unavailable')
      video.srcObject = stream
      await video.play()
      const canvas = canvasRef.current
      if (canvas) { canvas.width = video.videoWidth || 960; canvas.height = video.videoHeight || 720 }
      setState('detecting')
      setMessage('吕布挥戟而来：双手抬过肩膀、手肘展开，保持架挡姿势！')
      detect(performance.now())
    } catch {
      stopCamera()
      setState('error')
      setMessage('姿态模型或摄像头启动失败。请确认权限；也可按 Space 走可靠降级。')
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || state === 'success') return
      event.preventDefault()
      finish('fallback')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [finish, state])

  return <div className="rv-motion" role="dialog" aria-modal="true" aria-label="十秒接住吕布">
    <button className="rv-motion__close" type="button" onClick={() => { stopCamera(); onClose() }} aria-label="关闭体感挑战">×</button>
    <div className="rv-motion__copy">
      <small>MEDIAPIPE POSE · 本地骨骼识别</small>
      <h2>十秒接住吕布</h2>
      <p>虎牢关前，吕布第一戟冲你而来。不要挥刀：双臂抬过肩膀、手肘展开，做出稳定架挡。成功与失误都会继续故事，但人物关系不同。</p>
      <ol><li><b>1</b>不需要道具，站到摄像头前</li><li><b>2</b>让头、双肩、双手都在画面内</li><li><b>3</b>十秒内架挡，并保持约半秒</li></ol>
      <p className="rv-motion__privacy">视频不离开浏览器 · 屏幕只绘制骨骼 · 3D 打印与 ESP32 均为可选加分项</p>
    </div>
    <div className={`rv-motion__stage is-${state}`}>
      <video ref={videoRef} playsInline muted />
      <canvas ref={canvasRef} aria-label="本地识别到的上半身骨骼" />
      <div className="rv-motion__reticle"><i /><i /><span>{state === 'detecting' ? remaining : state === 'success' ? '✓' : state === 'timeout' ? '续' : '挡'}</span></div>
      <div className="rv-motion__countdown" role="progressbar" aria-label="动作挑战剩余时间" aria-valuemin={0} aria-valuemax={10} aria-valuenow={remaining}><i style={{ width: `${Math.max(0, Math.min(100, remaining * 10))}%` }} /><span>{state === 'detecting' ? `剩余 ${remaining} 秒` : '准备好后再开始'}</span></div>
      <div className="rv-motion__meter" aria-label={`架挡完成度 ${score}%`}><span style={{ width: `${score}%` }} /></div>
      <p role="status">{message}</p>
      <div className="rv-motion__actions">
        {(state === 'intro' || state === 'timeout' || state === 'error') && <button type="button" className="rv-primary" onClick={start}>{state === 'intro' ? '我已站好 · 开启摄像头' : '重新挑战 10 秒'}</button>}
        {state === 'loading' && <button type="button" disabled>正在加载骨骼模型…</button>}
        {state !== 'success' && <button type="button" onClick={() => finish('fallback')}>键盘降级 · Space</button>}
      </div>
    </div>
  </div>
}
