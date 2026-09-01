import { describe, expect, it } from 'vitest'
import { parseGeneratedStoryTurn } from './storyDirector'

const valid = {
  title: '雾中来客',
  paragraphs: ['你推开驿站木门，封泥上的裂痕比昨夜更深。蒙恬没有接信，只把守卫调到门外，要求来使先说出上一站的交接人。', '来使的手停在袖口。远处传来第二匹驿马的铃声，这意味着同一份命令可能还有另一条传递链，或者有人正试图制造这样的印象。'],
  characterReactions: [{ characterId: 'mengtian', publicText: '蒙恬按住诏书，要求先验封泥。', intent: '把不可逆命令变成可核验程序' }],
  suggestedActions: [{ id: 'check-seal', title: '比对封泥', intent: '核对两份封缄痕迹' }, { id: 'question-envoy', title: '询问来使', intent: '追查上一站交接人' }],
  imagePrompts: ['电影感秦代边郡驿站室内，扶苏与蒙恬围看破损封泥，来使站在门边，冷色晨光，无文字'],
  newThread: '第二匹驿马带来的到底是副本还是诱饵？',
}

describe('open story director contract', () => {
  it('accepts a grounded chapter with reactions, choices and a shot', () => {
    expect(parseGeneratedStoryTurn(valid, ['mengtian', 'envoy'])?.suggestedActions).toHaveLength(2)
  })

  it('keeps valid model prose when optional presentation metadata is omitted', () => {
    const sparse = { ...valid, newThread: '', characterReactions: [{ characterId: 'mengtian', publicText: '蒙恬按住诏书，要求先验封泥。' }] }
    const parsed = parseGeneratedStoryTurn(sparse, ['mengtian'])
    expect(parsed?.title).toBe('雾中来客')
    expect(parsed?.newThread).toContain('长期后果')
    expect(parsed?.characterReactions[0].intent).toContain('目标判断')
  })

  it('rejects reactions from characters outside the world bible', () => {
    expect(parseGeneratedStoryTurn({ ...valid, characterReactions: [{ characterId: 'invented', publicText: '凭空登场。', intent: '改写世界' }] }, ['mengtian'])).toBeNull()
  })

  it('rejects a thin one-paragraph continuation', () => {
    expect(parseGeneratedStoryTurn({ ...valid, paragraphs: ['太短了。'] }, ['mengtian'])).toBeNull()
  })

  it('accepts bounded state proposals and rejects unknown-shaped deltas', () => {
    expect(parseGeneratedStoryTurn({ ...valid, stateDelta: { itemChanges: [{ itemId: 'seal', holder: '蒙恬' }] } }, ['mengtian'])).not.toBeNull()
    expect(parseGeneratedStoryTurn({ ...valid, stateDelta: { itemChanges: [{ itemId: 'seal', magicalPower: '复活' }] } }, ['mengtian'])).toBeNull()
  })

  it('rejects deltas that mutate objects outside the authoritative memory', () => {
    const authority = { characterIds: ['mengtian'], itemIds: ['seal'], threadIds: ['thread-1'], locations: ['中军大帐'] }
    expect(parseGeneratedStoryTurn({ ...valid, stateDelta: { location: '中军大帐', itemChanges: [{ itemId: 'seal', holder: '蒙恬' }], resolvedThreadIds: ['thread-1'] } }, authority)).not.toBeNull()
    expect(parseGeneratedStoryTurn({ ...valid, stateDelta: { itemChanges: [{ itemId: 'magic-sword', holder: '蒙恬' }] } }, authority)).toBeNull()
    expect(parseGeneratedStoryTurn({ ...valid, stateDelta: { resolvedThreadIds: ['invented-thread'] } }, authority)).toBeNull()
    expect(parseGeneratedStoryTurn({ ...valid, stateDelta: { location: '凭空出现的宫殿' } }, authority)).toBeNull()
  })
})
