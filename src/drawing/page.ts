import { paperById, scaleCheck } from './paper'
import { textWidthMm } from './pdf'
import { mapSegment, type DrawItem, type Drawing, type StrokeStyle, type Vec } from './types'

/**
 * Put content onto printable pages.
 *
 * Content can be in any units. Choose how it maps to paper:
 *  - { mode: 'physical', mmPerUnit } — true size (1 for tools working in mm,
 *    or any scale, e.g. 1 unit = 2 mm). Adds scale-check rulers if asked.
 *    Too big for one sheet? `layoutPages` tiles it across several with
 *    overlaps and registration marks.
 *  - { mode: 'fit' } — scale to fill the printable area. For tools like
 *    Serpentine where units aren't tied to anything physical.
 */

export type PageScale = { mode: 'physical'; mmPerUnit: number } | { mode: 'fit' }

export interface PageHeader {
  title?: string
  /** Small grey text top-right, e.g. "Star Knobs template · 1:1" */
  tag?: string
  /** Spec lines under the title */
  lines?: string[]
  /** Smaller grey notes under the lines */
  notes?: string[]
}

export interface PageSetup {
  paperId: string
  landscape: boolean
  margin?: number
  header?: PageHeader
  /** Metric + imperial rulers (only for physical scale) */
  scaleCheck?: boolean
}

export interface PageContent {
  items: DrawItem[]
  /** Content bounds in content units */
  bounds: { x: number; y: number; width: number; height: number }
}

export interface SheetInfo {
  col: number
  row: number
  cols: number
  rows: number
  /** e.g. "B2" */
  label: string
}

export interface ComposedPage extends Drawing {
  /** mm per content unit actually used */
  mmPerUnit: number
  /** False if physical-scale content is bigger than the printable area */
  fits: boolean
  /** Printable area left for content, in mm */
  area: { x: number; y: number; width: number; height: number }
  /** Set when this page is one sheet of a tiled print */
  sheet?: SheetInfo
}

const TITLE = 5
const LINE = 2.8
const LINE_GAP = 4.2
const NOTE = 2.3
const NOTE_GAP = 3.4
const RULERS_HEIGHT = 26

function headerHeight(header?: PageHeader): number {
  if (!header) return 0
  let h = 0
  if (header.title || header.tag) h += 10
  if (header.lines?.length) h += header.lines.length * LINE_GAP
  if (header.notes?.length) h += 1 + header.notes.length * NOTE_GAP
  return h > 0 ? h + 4 : 0
}

/** Page size and the area left for content once header and rulers are placed */
export function pageArea(setup: PageSetup, physical = true): { width: number; height: number; area: ComposedPage['area'] } {
  const paper = paperById(setup.paperId)
  const width = setup.landscape ? paper.height : paper.width
  const height = setup.landscape ? paper.width : paper.height
  const margin = setup.margin ?? 10
  const top = margin + headerHeight(setup.header)
  const bottom = margin + (setup.scaleCheck && physical ? RULERS_HEIGHT : 0)
  return { width, height, area: { x: margin, y: top, width: width - margin * 2, height: height - top - bottom } }
}

/** Scale geometry (not stroke widths or text sizes, which stay in mm) */
export function scaleItems(items: DrawItem[], s: number, origin: Vec = { x: 0, y: 0 }): DrawItem[] {
  const p = (v: Vec): Vec => ({ x: origin.x + v.x * s, y: origin.y + v.y * s })
  return items.map((item) => {
    switch (item.kind) {
      case 'path':
        return { ...item, start: p(item.start), segments: item.segments.map((seg) => mapSegment(seg, p, s)) }
      case 'circle':
        return { ...item, center: p(item.center), radius: item.radius * s }
      case 'line':
        return { ...item, from: p(item.from), to: p(item.to) }
      case 'text':
        return { ...item, at: p(item.at) }
    }
  })
}

/** Header text and footer rulers/notes */
function pageChrome(setup: PageSetup, width: number, height: number, physical: boolean): DrawItem[] {
  const items: DrawItem[] = []
  const margin = setup.margin ?? 10
  const { header } = setup
  if (header) {
    let y = margin
    if (header.title || header.tag) {
      if (header.title) items.push({ kind: 'text', at: { x: margin, y: y + 4.5 }, text: header.title, size: TITLE, bold: true, layer: 'labels' })
      if (header.tag) items.push({ kind: 'text', at: { x: width - margin, y: y + 4.5 }, text: header.tag, size: 2.6, align: 'end', color: '#555555', layer: 'labels' })
      y += 10
    }
    for (const line of header.lines ?? []) {
      items.push({ kind: 'text', at: { x: margin, y }, text: line, size: LINE, layer: 'labels' })
      y += LINE_GAP
    }
    if (header.notes?.length) y += 1
    for (const note of header.notes ?? []) {
      items.push({ kind: 'text', at: { x: margin, y }, text: note, size: NOTE, color: '#444444', layer: 'labels' })
      y += NOTE_GAP
    }
  }
  if (physical && setup.scaleCheck) {
    items.push(...scaleCheck(margin, height - margin - RULERS_HEIGHT + 4, width - margin * 2).items)
  } else if (!physical && header) {
    const note = 'Fitted to page (not to scale)'
    items.push({ kind: 'text', at: { x: width - margin - textWidthMm(note, 2.3), y: height - margin + 4 }, text: note, size: 2.3, color: '#777777', layer: 'labels' })
  }
  return items
}

export function composePage(content: PageContent, setup: PageSetup, scale: PageScale): ComposedPage {
  const physical = scale.mode === 'physical'
  const { width, height, area } = pageArea(setup, physical)
  const { bounds } = content
  const mmPerUnit =
    scale.mode === 'physical'
      ? scale.mmPerUnit
      : Math.min(area.width / Math.max(bounds.width, 1e-9), area.height / Math.max(bounds.height, 1e-9))
  const w = bounds.width * mmPerUnit
  const h = bounds.height * mmPerUnit
  const fits = w <= area.width + 1e-6 && h <= area.height + 1e-6
  const origin = {
    x: area.x + (area.width - w) / 2 - bounds.x * mmPerUnit,
    y: area.y + Math.max(0, (area.height - h) / 2) - bounds.y * mmPerUnit,
  }
  const items = [...pageChrome(setup, width, height, physical), ...scaleItems(content.items, mmPerUnit, origin)]
  return { width, height, items, mmPerUnit, fits, area }
}

const MARK: StrokeStyle = { stroke: '#000000', width: 0.2, layer: 'registration' }
const JOIN: StrokeStyle = { stroke: '#888888', width: 0.15, dash: [2, 1.5], layer: 'registration' }
const colLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + Math.floor(i / 26) - 1)}${String.fromCharCode(65 + (i % 26))}`)

export interface TileOptions {
  /** How far neighbouring sheets overlap, in mm */
  overlap?: number
}

/**
 * Split true-size content across as many sheets as it needs. Neighbouring
 * sheets overlap; a dashed join line runs down the middle of each overlap,
 * with registration marks on it to line the sheets up before taping.
 */
export function tilePages(content: PageContent, setup: PageSetup, mmPerUnit: number, options: TileOptions = {}): ComposedPage[] {
  const overlap = options.overlap ?? 12
  const title = setup.header?.title
  // Every sheet needs the same printable area, so use a compact one-line header on all of them
  const probe: PageSetup = { ...setup, header: { title, tag: 'Sheet A1 of 1' } }
  const { width, height, area } = pageArea(probe)
  const cellW = area.width - overlap
  const cellH = area.height - overlap
  const W = content.bounds.width * mmPerUnit
  const H = content.bounds.height * mmPerUnit
  const cols = Math.max(1, Math.ceil((W - overlap) / cellW))
  const rows = Math.max(1, Math.ceil((H - overlap) / cellH))
  const offset = { x: (cols * cellW + overlap - W) / 2, y: (rows * cellH + overlap - H) / 2 }
  const totalW = cols * cellW + overlap
  const totalH = rows * cellH + overlap

  // Join lines and registration marks in global sheet-grid mm
  const marks: DrawItem[] = []
  const cross = (x: number, y: number) => {
    marks.push({ kind: 'circle', center: { x, y }, radius: 2.5, style: MARK })
    marks.push({ kind: 'line', from: { x: x - 4, y }, to: { x: x + 4, y }, style: MARK })
    marks.push({ kind: 'line', from: { x, y: y - 4 }, to: { x, y: y + 4 }, style: MARK })
  }
  const joinsX = Array.from({ length: cols - 1 }, (_, i) => (i + 1) * cellW + overlap / 2)
  const joinsY = Array.from({ length: rows - 1 }, (_, i) => (i + 1) * cellH + overlap / 2)
  for (const x of joinsX) {
    marks.push({ kind: 'line', from: { x, y: 0 }, to: { x, y: totalH }, style: JOIN })
    for (let r = 0; r < rows; r++) for (const f of [0.25, 0.75]) cross(x, r * cellH + overlap / 2 + cellH * f)
  }
  for (const y of joinsY) {
    marks.push({ kind: 'line', from: { x: 0, y }, to: { x: totalW, y }, style: JOIN })
    for (let c = 0; c < cols; c++) for (const f of [0.25, 0.75]) cross(c * cellW + overlap / 2 + cellW * f, y)
  }
  for (const x of joinsX) for (const y of joinsY) cross(x, y)

  const pages: ComposedPage[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const label = `${colLetter(col)}${row + 1}`
      const sheetSetup: PageSetup = { ...setup, header: { title, tag: `Sheet ${label} of ${cols} × ${rows} · overlap ${overlap} mm, tape along the dashed line` } }
      // Global grid → this sheet
      const gx = area.x - col * cellW
      const gy = area.y - row * cellH
      const contentOrigin = { x: gx + offset.x - content.bounds.x * mmPerUnit, y: gy + offset.y - content.bounds.y * mmPerUnit }
      pages.push({
        width,
        height,
        area,
        mmPerUnit,
        fits: true,
        clip: area,
        sheet: { col, row, cols, rows, label },
        overlay: pageChrome(sheetSetup, width, height, true),
        items: [
          { kind: 'path', start: { x: area.x, y: area.y }, segments: [
            { type: 'line', to: { x: area.x + area.width, y: area.y } },
            { type: 'line', to: { x: area.x + area.width, y: area.y + area.height } },
            { type: 'line', to: { x: area.x, y: area.y + area.height } },
          ], closed: true, style: { stroke: '#cccccc', width: 0.15, layer: 'registration' } },
          ...scaleItems(content.items, mmPerUnit, contentOrigin),
          ...scaleItems(marks, 1, { x: gx, y: gy }),
          // Sheet label kept clear of the overlap strips (and their marks)
          { kind: 'text', at: { x: area.x + overlap + 3, y: area.y + overlap + 8 }, text: label, size: 6, bold: true, color: '#bbbbbb', layer: 'registration' },
        ],
      })
    }
  }
  return pages
}

/** One page when it fits (or when fitting to page); otherwise tiled sheets */
export function layoutPages(content: PageContent, setup: PageSetup, scale: PageScale, options: TileOptions = {}): ComposedPage[] {
  const single = composePage(content, setup, scale)
  if (scale.mode === 'fit' || single.fits) return [single]
  return tilePages(content, setup, scale.mmPerUnit, options)
}
