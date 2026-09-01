import type { CompanionId } from '../types'

type CharacterKind = CompanionId | 'fox' | 'bear'

interface CharacterProps {
  kind: CharacterKind
  size?: 'small' | 'medium' | 'large'
  mood?: 'neutral' | 'sad' | 'happy' | 'thinking'
  label?: string
}

export function Character({ kind, size = 'medium', mood = 'neutral', label }: CharacterProps) {
  return (
    <div className={`character character--${kind} character--${size}`} aria-label={label} role={label ? 'img' : undefined}>
      <svg viewBox="0 0 120 130" aria-hidden="true">
        {kind === 'fox' && (
          <>
            <path className="character__tail" d="M89 89c29 1 29 25 5 27-11 1-16-4-18-9 15 3 21-4 13-18Z" />
            <path className="character__ear" d="m32 35 5-28 22 24M88 35 83 7 62 31" />
            <path className="character__body" d="M31 78c0-25 12-39 29-39s29 14 29 39v30c-11 12-47 12-58 0V78Z" />
            <path className="character__face-patch" d="M37 54c9 2 16 8 23 18 7-10 14-16 23-18-1 25-9 36-23 36S38 79 37 54Z" />
          </>
        )}
        {kind === 'bear' && (
          <>
            <circle className="character__ear" cx="36" cy="31" r="16" />
            <circle className="character__ear" cx="84" cy="31" r="16" />
            <path className="character__body" d="M27 75c0-28 13-45 33-45s33 17 33 45v34c-13 11-53 11-66 0V75Z" />
            <ellipse className="character__face-patch" cx="60" cy="70" rx="22" ry="19" />
          </>
        )}
        {kind === 'chongchong' && (
          <>
            <path className="character__wing" d="M38 65C12 67 12 93 42 89M82 65c26 2 26 28-4 24" />
            <path className="character__body" d="M31 72c0-27 12-43 29-43s29 16 29 43-11 46-29 46-29-19-29-46Z" />
            <path className="character__beak" d="m88 63 22 9-22 9Z" />
            <path className="character__crest" d="M46 32 52 12l9 18 13-17 1 23" />
          </>
        )}
        {kind === 'manman' && (
          <>
            <ellipse className="character__shell" cx="55" cy="81" rx="42" ry="34" />
            <path className="character__shell-line" d="M28 62c15 10 35 10 54 0M27 96c18-9 37-9 56 0M55 48v66" />
            <circle className="character__body" cx="94" cy="70" r="20" />
            <path className="character__feet" d="M31 108v12M71 108v12" />
          </>
        )}
        {kind === 'tingting' && (
          <>
            <ellipse className="character__ear" cx="45" cy="29" rx="12" ry="29" transform="rotate(-9 45 29)" />
            <ellipse className="character__ear" cx="76" cy="29" rx="12" ry="29" transform="rotate(9 76 29)" />
            <path className="character__body" d="M28 79c0-27 13-44 32-44s32 17 32 44v30c-12 11-52 11-64 0V79Z" />
            <ellipse className="character__belly" cx="60" cy="92" rx="20" ry="24" />
          </>
        )}
        <g className={`character__expression character__expression--${mood}`}>
          <circle cx={kind === 'manman' ? 91 : 49} cy={kind === 'manman' ? 65 : 62} r="3" />
          <circle cx={kind === 'manman' ? 101 : 72} cy={kind === 'manman' ? 65 : 62} r="3" />
          {mood === 'sad' ? (
            <path d={kind === 'manman' ? 'M92 79q5-7 10 0' : 'M53 80q7-8 14 0'} />
          ) : mood === 'happy' ? (
            <path d={kind === 'manman' ? 'M92 75q5 8 10 0' : 'M53 76q7 9 14 0'} />
          ) : (
            <path d={kind === 'manman' ? 'M93 76h8' : 'M55 78h11'} />
          )}
        </g>
      </svg>
    </div>
  )
}
