import { afterEach, describe, expect, it, vi } from 'vitest'
import { matchAppleDisplays, pxPerMmFromDiagonal, resolveScreenScale, type ScreenInfo } from './screenScale'

const info = (width: number, height: number, dpr = 2, isMac = true): ScreenInfo => ({ width, height, dpr, isMac, signature: `${width}x${height}@${dpr}`, zoomed: false })

function stubScreen(width: number, height: number, dpr: number, platform = 'MacIntel') {
  vi.stubGlobal('window', { screen: { width, height }, devicePixelRatio: dpr })
  vi.stubGlobal('navigator', { platform, maxTouchPoints: 0 })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('screen scale', () => {
  it('recognises a MacBook Pro 14″ at default and scaled modes with the same physical scale', () => {
    const def = matchAppleDisplays(info(1512, 982))
    const more = matchAppleDisplays(info(1800, 1169))
    expect(def[0].model.id).toBe('mbp-14')
    expect(def[0].isDefault).toBe(true)
    // More space → more CSS px per mm, but both span the same 302.5 mm panel
    expect(def[0].pxPerMm * 302.5).toBeCloseTo(1512, 0)
    expect(more[0].pxPerMm).toBeGreaterThan(def[0].pxPerMm)
  })

  it('is confident only when the match is unambiguous', () => {
    stubScreen(1512, 982, 2)
    expect(resolveScreenScale({}).confident).toBe(true)
    stubScreen(1440, 900, 2) // 13″ and 15″ MacBooks both default to this
    const s = resolveScreenScale({})
    expect(s.confident).toBe(false)
    expect(s.matches.length).toBeGreaterThan(1)
  })

  it('prefers a saved calibration for this screen', () => {
    stubScreen(1920, 1080, 1, 'Win32')
    const s = resolveScreenScale({ '1920x1080@1': { pxPerMm: 3.6, source: 'diagonal', label: '24″ screen' } })
    expect(s.pxPerMm).toBe(3.6)
    expect(s.confident).toBe(true)
    expect(resolveScreenScale({}).confident).toBe(false)
  })

  it('works out scale from a diagonal', () => {
    // 27″ 16:9 at 2560 px wide ≈ 597.7 mm → 4.28 px/mm
    expect(pxPerMmFromDiagonal(27, info(2560, 1440, 1, false))).toBeCloseTo(4.283, 2)
  })
})
