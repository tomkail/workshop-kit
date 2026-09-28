import { describe, expect, it } from 'vitest'
import { NO_MODIFIERS, isModifierHeld } from './tooltip'

describe('tooltip modifier hints', () => {
  it('lights up a hint while its key is held', () => {
    expect(isModifierHeld('⇧ drag freely', { ...NO_MODIFIERS, shift: true })).toBe(true)
    expect(isModifierHeld('⇧ drag freely', NO_MODIFIERS)).toBe(false)
    expect(isModifierHeld('⌥ from opposite', { ...NO_MODIFIERS, shift: true })).toBe(false)
    expect(isModifierHeld('⇧/⌥ reset both', { ...NO_MODIFIERS, alt: true })).toBe(true)
    expect(isModifierHeld('Right-click reset', { shift: true, alt: true, meta: true, ctrl: true })).toBe(false)
  })
})
