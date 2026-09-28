import { describe, expect, it } from 'vitest'
import { composePage, layoutPages } from './page'
import { ellipseArcToCubics, itemsBounds } from './curves'
import type { DrawItem } from './types'

const circle = (x: number, y: number, radius: number): DrawItem => ({ kind: 'circle', center: { x, y }, radius, style: { stroke: '#000', width: 0.3, layer: 'art' } })

describe('composePage', () => {
  it('fits unitless content to the printable area', () => {
    // A 1000 × 500 unit drawing (e.g. Serpentine canvas units) on landscape A4
    const page = composePage({ items: [circle(500, 250, 250)], bounds: { x: 0, y: 0, width: 1000, height: 500 } }, { paperId: 'a4', landscape: true, scaleCheck: true }, { mode: 'fit' })
    expect(page.width).toBe(297)
    expect(page.mmPerUnit).toBeCloseTo(277 / 1000)
    const c = page.items.find((i) => i.kind === 'circle' && i.style.layer === 'art') as Extract<DrawItem, { kind: 'circle' }>
    expect(c.radius).toBeCloseTo(250 * page.mmPerUnit)
    expect(c.style.width).toBe(0.3) // strokes stay in mm
    // No rulers when not to scale
    expect(page.items.some((i) => i.kind === 'text' && i.text.includes('Print scale check'))).toBe(false)
  })

  it('places content at a chosen physical scale and reports overflow', () => {
    const page = composePage({ items: [circle(0, 0, 50)], bounds: { x: -50, y: -50, width: 100, height: 100 } }, { paperId: 'a4', landscape: false, scaleCheck: true }, { mode: 'physical', mmPerUnit: 1.5 })
    expect(page.fits).toBe(true)
    expect((page.items.find((i) => i.kind === 'circle' && i.style.layer === 'art') as Extract<DrawItem, { kind: 'circle' }>).radius).toBe(75)
    expect(page.items.some((i) => i.kind === 'text' && i.text.includes('Print scale check'))).toBe(true)
    const big = composePage({ items: [], bounds: { x: 0, y: 0, width: 300, height: 10 } }, { paperId: 'a4', landscape: false }, { mode: 'physical', mmPerUnit: 1 })
    expect(big.fits).toBe(false)
  })
})

describe('tiling', () => {
  it('splits a guitar-sized drawing across overlapping A4 sheets', () => {
    // 520 × 380 mm body at 1 unit = 1 mm
    const content = { items: [circle(260, 190, 180)], bounds: { x: 0, y: 0, width: 520, height: 380 } }
    const pages = layoutPages(content, { paperId: 'a4', landscape: false, header: { title: 'Body' }, scaleCheck: true }, { mode: 'physical', mmPerUnit: 1 })
    // Header and rulers sit in the unclipped overlay so the sheet clip can't hide them
    for (const page of pages) {
      expect(page.overlay?.some((i) => i.kind === 'text' && i.text.includes('Print scale check'))).toBe(true)
      expect(page.overlay?.some((i) => i.kind === 'text' && i.text.startsWith(`Sheet ${page.sheet!.label} of`))).toBe(true)
    }
    expect(pages.length).toBeGreaterThan(1)
    const { cols, rows } = pages[0].sheet!
    expect(pages.length).toBe(cols * rows)
    expect(pages.map((p) => p.sheet!.label)).toContain('B2')
    // Every sheet clips to the same printable area, and the circle keeps its true radius
    for (const page of pages) {
      expect(page.clip).toEqual(pages[0].area)
      const c = page.items.find((i) => i.kind === 'circle' && i.style.layer === 'art') as Extract<(typeof page.items)[number], { kind: 'circle' }>
      expect(c.radius).toBe(180)
    }
    // Neighbouring sheets see the same circle centre shifted by exactly one cell
    const a1 = pages[0].items.find((i) => i.kind === 'circle' && i.style.layer === 'art') as { center: { x: number } }
    const b1 = pages[1].items.find((i) => i.kind === 'circle' && i.style.layer === 'art') as { center: { x: number } }
    expect(a1.center.x - b1.center.x).toBeCloseTo(pages[0].area.width - 12)
  })

  it('keeps a single page when the content fits', () => {
    const pages = layoutPages({ items: [circle(0, 0, 20)], bounds: { x: -20, y: -20, width: 40, height: 40 } }, { paperId: 'a4', landscape: false }, { mode: 'physical', mmPerUnit: 1 })
    expect(pages).toHaveLength(1)
    expect(pages[0].sheet).toBeUndefined()
  })
})

describe('curves', () => {
  it('converts an elliptical arc to Béziers that stay on the ellipse', () => {
    const cubics = ellipseArcToCubics({ x: 10, y: 5 }, 40, 20, Math.PI / 6, 0, Math.PI * 1.5, false)
    expect(cubics).toHaveLength(3)
    const end = cubics[cubics.length - 1].to
    // End point is at local angle 270°: (0, -20) rotated by 30°
    expect(end.x).toBeCloseTo(10 + 20 * Math.sin(Math.PI / 6))
    expect(end.y).toBeCloseTo(5 - 20 * Math.cos(Math.PI / 6))
    const b = itemsBounds([{ kind: 'path', start: { x: 10 + 40 * Math.cos(Math.PI / 6), y: 5 + 40 * Math.sin(Math.PI / 6) }, segments: cubics, closed: false, style: { layer: 'x' } }])
    expect(b.width).toBeGreaterThan(40)
  })
})
