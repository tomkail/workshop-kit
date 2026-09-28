import { describe, expect, it } from 'vitest'
import { formatLength, parseLength } from './units'
import { nearestBit } from './drillBits'

describe('units', () => {
  it('parses fractions and units', () => {
    expect(parseLength('3/4', 'in')).toBeCloseTo(19.05)
    expect(parseLength('1 1/4"', 'mm')).toBeCloseTo(31.75)
    expect(parseLength('20', 'mm')).toBe(20)
    expect(parseLength('2cm', 'in')).toBe(20)
    expect(parseLength('abc', 'mm')).toBeNull()
  })

  it('formats inches as fractions when exact', () => {
    expect(formatLength(19.05, 'in')).toBe('3/4″')
    expect(formatLength(20, 'in')).toBe('0.787″')
    expect(formatLength(20, 'mm')).toBe('20 mm')
    expect(formatLength(100, 'mm', { mmDecimals: 0 })).toBe('100 mm')
    expect(formatLength(60.5, 'mm')).toBe('60.5 mm')
  })

  it('finds the nearest standard bit', () => {
    expect(nearestBit(19.5, 'mm').diameter).toBe(20)
    expect(nearestBit(19.5, 'in').label).toBe('3/4″')
  })
})
