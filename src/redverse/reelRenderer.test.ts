import { describe, expect, it } from 'vitest'
import { downloadBlob } from './reelRenderer'

describe('reel renderer helpers', () => {
  it('downloads a generated reel blob without uploading it', () => {
    const click = HTMLAnchorElement.prototype.click
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    HTMLAnchorElement.prototype.click = () => undefined
    URL.createObjectURL = () => 'blob:reel'
    URL.revokeObjectURL = () => undefined
    expect(() => downloadBlob(new Blob(['video']), 'redverse.webm')).not.toThrow()
    HTMLAnchorElement.prototype.click = click
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  })
})
