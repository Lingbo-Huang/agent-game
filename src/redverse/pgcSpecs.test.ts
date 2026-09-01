import { describe, expect, it } from 'vitest'
import { caocaoPgcSpec, classicPgcSpec, fusuPgcSpec } from './pgcSpecs'

describe('generative PGC world bibles', () => {
  it.each([caocaoPgcSpec, classicPgcSpec, fusuPgcSpec])('gives $title enough authority for open action generation', (spec) => {
    expect(spec.fallbackBeats.length).toBeGreaterThanOrEqual(10)
    expect(spec.characters.length).toBeGreaterThanOrEqual(4)
    expect(spec.items.length).toBeGreaterThanOrEqual(4)
    expect(new Set(spec.fallbackBeats.map((beat) => beat.location)).size).toBeGreaterThanOrEqual(4)
    expect(spec.canonConstraints.length).toBeGreaterThanOrEqual(4)
    expect(spec.fallbackBeats.every((beat) => beat.choices.length >= 3)).toBe(true)
  })

  it('ships the confirmed Fusu opening artwork in the runtime spec', () => {
    expect(fusuPgcSpec.openingImage).toBe('/pgc/fusu/v1/01-shangjun-opening.webp')
  })

  it('ships a lightweight straw-boats opening artwork instead of an empty first scene', () => {
    expect(classicPgcSpec.openingImage).toBe('/pgc/classic/v1/01-riverside-preparation.webp')
  })

  it('keeps the Cao Cao flagship world irreversible and character-driven', () => {
    expect(caocaoPgcSpec.characters).toHaveLength(7)
    expect(caocaoPgcSpec.fallbackBeats).toHaveLength(10)
    expect(caocaoPgcSpec.canonConstraints.join('')).toContain('不可逆')
    expect(caocaoPgcSpec.openingImage).toContain('/pgc/caocao/')
  })
})
