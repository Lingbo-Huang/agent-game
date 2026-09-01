import { describe, expect, it } from 'vitest'
import { isMimoApiKey, MIMO_APPLICATION_URL } from './useMimoVoice'

describe('MiMo voice configuration', () => {
  it('accepts only plausible secret keys', () => {
    expect(isMimoApiKey(['sk', 'x'.repeat(32)].join('-'))).toBe(true)
    expect(isMimoApiKey(['tp', 'x'.repeat(32)].join('-'))).toBe(true)
    expect(isMimoApiKey('sk-short')).toBe(false)
    expect(isMimoApiKey('not-a-provider-key')).toBe(false)
  })

  it('uses the current official API key console route', () => {
    expect(MIMO_APPLICATION_URL).toContain('/#/console/api-keys')
  })

  it('keeps the provider key out of persistent local storage by design', () => {
    expect(localStorage.getItem('redverse:mimo-key')).toBeNull()
  })

  it('does not treat an unrelated provider key as a MiMo key', () => {
    expect(isMimoApiKey('not-a-mimo-key')).toBe(false)
  })
})
