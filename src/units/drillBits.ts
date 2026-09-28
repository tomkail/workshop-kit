import { MM_PER_INCH, formatLength, type LengthUnit } from './units'

export interface DrillBit {
  /** Diameter in mm */
  diameter: number
  label: string
  system: LengthUnit
}

/** Commonly available metric Forstner / brad-point sizes (mm) */
const METRIC_SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 22, 24, 25, 26, 28, 30, 32, 34, 35, 36, 38, 40, 45, 50, 55, 60, 65]

/** Commonly available imperial sizes in 64ths: 1/8″–1″ by 1/16″, then by 1/8″ to 2 1/8″, plus 2 1/4″ and 2 1/2″ */
const IMPERIAL_64THS = [
  ...Array.from({ length: 15 }, (_, i) => 8 + i * 4), // 1/8 .. 1
  ...Array.from({ length: 9 }, (_, i) => 72 + i * 8), // 1 1/8 .. 2 1/8
  144,
  160,
]

export const METRIC_BITS: DrillBit[] = METRIC_SIZES.map((d) => ({ diameter: d, label: `${d} mm`, system: 'mm' }))

export const IMPERIAL_BITS: DrillBit[] = IMPERIAL_64THS.map((n) => {
  const mm = (n / 64) * MM_PER_INCH
  return { diameter: mm, label: formatLength(mm, 'in'), system: 'in' }
})

export function bitsFor(unit: LengthUnit): DrillBit[] {
  return unit === 'in' ? IMPERIAL_BITS : METRIC_BITS
}

/** The standard bit closest to a diameter (mm) */
export function nearestBit(diameter: number, unit: LengthUnit): DrillBit {
  const bits = bitsFor(unit)
  return bits.reduce((best, bit) => (Math.abs(bit.diameter - diameter) < Math.abs(best.diameter - diameter) ? bit : best), bits[0])
}

/** True when a diameter matches a standard bit in either system */
export function isStandardBit(diameter: number): DrillBit | null {
  const all = [...METRIC_BITS, ...IMPERIAL_BITS]
  return all.find((bit) => Math.abs(bit.diameter - diameter) < 0.01) ?? null
}
