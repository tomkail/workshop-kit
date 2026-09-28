/**
 * Length units for workshop tools. All geometry is stored in millimetres;
 * these helpers convert for display and parse what people type.
 */

export type LengthUnit = 'mm' | 'in'

export const MM_PER_INCH = 25.4

/**
 * Metric everywhere except the few countries that still use US customary
 * units day to day (US, Liberia, Myanmar). Note Canada, Mexico etc. use
 * Letter paper but are metric, so paper and unit defaults are separate.
 */
export function defaultUnit(): LengthUnit {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-GB'
  const region = locale.split('-')[1]?.toUpperCase()
  return region && ['US', 'LR', 'MM'].includes(region) ? 'in' : 'mm'
}

export function toUnit(mm: number, unit: LengthUnit): number {
  return unit === 'in' ? mm / MM_PER_INCH : mm
}

export function fromUnit(value: number, unit: LengthUnit): number {
  return unit === 'in' ? value * MM_PER_INCH : value
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * Nearest fraction with a power-of-two denominator, e.g. 0.78125 → "25/32".
 * Returns whole + fraction ("1 1/4") and how far off the fraction is (in inches).
 */
export function toFraction(inches: number, maxDenominator = 64): { text: string; error: number } {
  const sign = inches < 0 ? '-' : ''
  const abs = Math.abs(inches)
  let numerator = Math.round(abs * maxDenominator)
  let denominator = maxDenominator
  const error = numerator / denominator - abs
  const whole = Math.floor(numerator / denominator)
  numerator -= whole * denominator
  if (numerator === 0) return { text: `${sign}${whole}`, error }
  const divisor = gcd(numerator, denominator)
  numerator /= divisor
  denominator /= divisor
  return { text: `${sign}${whole > 0 ? `${whole} ` : ''}${numerator}/${denominator}`, error }
}

function trimNumber(value: number, decimals: number): string {
  const text = value.toFixed(decimals)
  // Only trim zeros after a decimal point ("100" must stay "100")
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}

export interface FormatOptions {
  /** Decimal places for mm (default 1) */
  mmDecimals?: number
  /** Decimal places for decimal inches (default 3) */
  inDecimals?: number
  /** Show inches as fractions when they land within 0.002" of a 1/64 */
  fractions?: boolean
  /** Append the unit symbol */
  withUnit?: boolean
}

/** Format a millimetre value in the given unit */
export function formatLength(mm: number, unit: LengthUnit, options: FormatOptions = {}): string {
  const { mmDecimals = 1, inDecimals = 3, fractions = true, withUnit = true } = options
  if (unit === 'mm') {
    return `${trimNumber(mm, mmDecimals)}${withUnit ? ' mm' : ''}`
  }
  const inches = mm / MM_PER_INCH
  if (fractions) {
    const fraction = toFraction(inches)
    if (Math.abs(fraction.error) < 0.002 && fraction.text.includes('/')) {
      return `${fraction.text}${withUnit ? '″' : ''}`
    }
  }
  return `${trimNumber(inches, inDecimals)}${withUnit ? '″' : ''}`
}

/** "20 mm (25/32″)" style label showing both systems */
export function formatDual(mm: number, primary: LengthUnit, options: FormatOptions = {}): string {
  const secondary: LengthUnit = primary === 'mm' ? 'in' : 'mm'
  const approx = secondary === 'in' ? approxFraction(mm) : formatLength(mm, 'mm', options)
  return `${formatLength(mm, primary, options)} (${approx})`
}

/** Nearest 1/64″ with ≈ when inexact, e.g. "≈ 25/32″" */
export function approxFraction(mm: number): string {
  const inches = mm / MM_PER_INCH
  const fraction = toFraction(inches)
  const exact = Math.abs(fraction.error) < 0.0005
  return `${exact ? '' : '≈ '}${fraction.text}″`
}

/**
 * Parse typed lengths. Accepts "20", "20mm", "2cm", "0.75in", "3/4", "1 1/4\"", "1-1/4in".
 * Bare numbers are read in `unit`. Returns millimetres, or null if unparseable.
 */
export function parseLength(text: string, unit: LengthUnit): number | null {
  let s = text.trim().toLowerCase().replace(/″|''|"/g, 'in').replace(/,/g, '.')
  if (!s) return null

  let sourceUnit: LengthUnit | 'cm' = unit
  const unitMatch = s.match(/(mm|cm|in|inch|inches)$/)
  if (unitMatch) {
    const u = unitMatch[1]
    sourceUnit = u === 'mm' ? 'mm' : u === 'cm' ? 'cm' : 'in'
    s = s.slice(0, -u.length).trim()
  }

  // whole + fraction: "1 1/4" or "1-1/4"
  let value: number | null = null
  const mixed = s.match(/^(-?\d+(?:\.\d+)?)[\s-]+(\d+)\/(\d+)$/)
  const fraction = s.match(/^(-?\d+)\/(\d+)$/)
  if (mixed) {
    const whole = parseFloat(mixed[1])
    const frac = parseInt(mixed[2], 10) / parseInt(mixed[3], 10)
    value = whole < 0 ? whole - frac : whole + frac
  } else if (fraction) {
    value = parseInt(fraction[1], 10) / parseInt(fraction[2], 10)
  } else if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) {
    value = parseFloat(s)
  }
  if (value === null || !Number.isFinite(value)) return null

  if (sourceUnit === 'cm') return value * 10
  return fromUnit(value, sourceUnit)
}

/** Snap a millimetre value to a grid expressed in the user's unit */
export function snapLength(mm: number, unit: LengthUnit, stepInUnit: number): number {
  const v = toUnit(mm, unit)
  return fromUnit(Math.round(v / stepInUnit) * stepInUnit, unit)
}
