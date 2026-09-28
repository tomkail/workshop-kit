import type { DrawItem, StrokeStyle } from './types'

export interface PaperSize {
  id: string
  label: string
  /** Portrait width × height in mm */
  width: number
  height: number
}

export const PAPER_SIZES: PaperSize[] = [
  { id: 'a4', label: 'A4 (210 × 297 mm)', width: 210, height: 297 },
  { id: 'letter', label: 'US Letter (8.5 × 11″)', width: 215.9, height: 279.4 },
  { id: 'a3', label: 'A3 (297 × 420 mm)', width: 297, height: 420 },
  { id: 'legal', label: 'US Legal (8.5 × 14″)', width: 215.9, height: 355.6 },
  { id: 'tabloid', label: 'Tabloid (11 × 17″)', width: 279.4, height: 431.8 },
]

export function paperById(id: string): PaperSize {
  return PAPER_SIZES.find((p) => p.id === id) ?? PAPER_SIZES[0]
}

/** Guess a default paper from the browser locale (US/Canada/Mexico etc. use Letter) */
export function defaultPaperId(): string {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-GB'
  const region = locale.split('-')[1]?.toUpperCase()
  return region && ['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE'].includes(region) ? 'letter' : 'a4'
}

const RULER: StrokeStyle = { stroke: '#000', width: 0.2, layer: 'scale-check' }

/**
 * Metric + imperial rulers for checking print scale.
 * Returns items and the height used. (x, y) is the top-left corner.
 */
export function scaleCheck(x: number, y: number, maxWidth: number): { items: DrawItem[]; height: number } {
  const items: DrawItem[] = []
  const text = (at: { x: number; y: number }, t: string, size = 2.4, align: 'start' | 'middle' | 'end' = 'start', bold = false): DrawItem => ({
    kind: 'text',
    at,
    text: t,
    size,
    align,
    bold,
    layer: 'scale-check',
  })

  const mmLength = maxWidth >= 105 ? 100 : 50
  const inLength = maxWidth >= 105 ? 4 : 2
  const tick = (x0: number, y0: number, len: number): DrawItem => ({ kind: 'line', from: { x: x0, y: y0 }, to: { x: x0, y: y0 + len }, style: RULER })

  items.push(text({ x, y: y + 2.4 }, 'Print scale check — these rulers must measure exactly as labelled. Print at 100% / "Actual size".', 2.4, 'start', true))

  // Metric ruler
  const my = y + 5
  items.push({ kind: 'line', from: { x, y: my }, to: { x: x + mmLength, y: my }, style: RULER })
  for (let i = 0; i <= mmLength; i++) {
    const len = i % 10 === 0 ? 3 : i % 5 === 0 ? 2 : 1
    items.push(tick(x + i, my, len))
    if (i % 10 === 0) items.push(text({ x: x + i, y: my + 5.6 }, String(i / 10), 1.8, 'middle'))
  }
  items.push(text({ x: x + mmLength + 2, y: my + 2.8 }, `${mmLength} mm (cm marks)`, 2.2))

  // Imperial ruler
  const iy = my + 9
  const inch = 25.4
  items.push({ kind: 'line', from: { x, y: iy }, to: { x: x + inLength * inch, y: iy }, style: RULER })
  for (let i = 0; i <= inLength * 16; i++) {
    const len = i % 16 === 0 ? 3 : i % 8 === 0 ? 2.2 : i % 4 === 0 ? 1.6 : 1
    items.push(tick(x + (i * inch) / 16, iy, len))
    if (i % 16 === 0) items.push(text({ x: x + (i * inch) / 16, y: iy + 5.6 }, String(i / 16), 1.8, 'middle'))
  }
  items.push(text({ x: x + inLength * inch + 2, y: iy + 2.8 }, `${inLength} in (1/16 marks)`, 2.2))

  return { items, height: iy + 7 - y }
}
