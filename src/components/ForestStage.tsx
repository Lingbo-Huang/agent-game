import { Character } from './Character'
import type { StoryStep } from '../types'

interface ForestStageProps {
  step: StoryStep
  sceneLabel?: string
  perspectiveRevealed?: boolean
  outcomeHappy?: boolean
}

export function ForestStage({ step, sceneLabel = '森林里的互动绘本画面', perspectiveRevealed = false, outcomeHappy = false }: ForestStageProps) {
  const showFriends = step === 'companions' || step === 'sentence' || step === 'outcome' || step === 'card'
  const bearMood = perspectiveRevealed || outcomeHappy ? 'thinking' : 'neutral'
  const generatedLabel = step === 'cover'
    ? '认识尾巴天气剧场的五位固定角色'
    : perspectiveRevealed
      ? '从小熊的位置重看森林音乐会，补上原来不知道的部分'
      : '五位伙伴来到夜晚的森林音乐会，小狐狸头顶出现一朵雨云'
  const generatedScene = step === 'cover'
    ? '/characters/children/miora-v1/lili-character-sheet-v1.png'
    : step === 'emotion'
      ? '/children/characters/v1/emotion-weather-choice.webp'
      : step === 'companions' || step === 'perspective'
        ? perspectiveRevealed
          ? '/children/characters/v1/perspective-reveal-v1.webp'
          : '/children/characters/v1/forest-concert-opening.webp'
        : step === 'outcome' || step === 'card'
          ? '/children/characters/v1/outcome-bridge-v1.webp'
          : undefined

  return (
    <div className={`forest-stage forest-stage--${step} ${perspectiveRevealed ? 'forest-stage--bear-view' : ''}`} aria-label={sceneLabel} role="img">
      {generatedScene && <img className="forest-stage__generated" src={generatedScene} alt={generatedLabel} loading={step === 'cover' ? 'eager' : 'lazy'} decoding="async" />}
      <div className={generatedScene ? 'forest-stage__fallback forest-stage__fallback--covered' : 'forest-stage__fallback'}>
      <div className="forest-stage__sun" />
      <div className="forest-stage__cloud forest-stage__cloud--one" />
      <div className="forest-stage__cloud forest-stage__cloud--two" />
      <div className="forest-stage__tree forest-stage__tree--left"><i /><i /><i /></div>
      <div className="forest-stage__tree forest-stage__tree--right"><i /><i /><i /></div>
      <div className="forest-stage__bunting" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="forest-stage__ground" />
      <div className="forest-stage__music-note note-one">♪</div>
      <div className="forest-stage__music-note note-two">♫</div>
      <div className="forest-stage__circle" />
      <div className="forest-stage__chair chair-one" />
      <div className="forest-stage__chair chair-two" />
      <div className="forest-stage__chair chair-three" />
      <div className="forest-stage__bear"><Character kind="bear" mood={bearMood} /></div>
      <div className="forest-stage__fox"><Character kind="fox" mood={outcomeHappy ? 'happy' : 'sad'} /></div>
      {showFriends && (
        <div className="forest-stage__friends">
          <Character kind="chongchong" size="small" />
          <Character kind="manman" size="small" />
          <Character kind="tingting" size="small" />
        </div>
      )}
      {perspectiveRevealed && (
        <div className="forest-stage__thought">
          <strong>原来，我没有看见全部……</strong>
        </div>
      )}
      {step === 'emotion' && <div className="forest-stage__raincloud"><i /><i /><i /></div>}
      </div>
    </div>
  )
}
