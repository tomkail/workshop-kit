import { arcSweep, type Drawing, type DrawItem, type StrokeStyle, type Vec } from './types'

/**
 * Dependency-free vector PDF writer. Each Drawing becomes one page whose
 * MediaBox is the drawing size, so printing "Actual size" gives 1:1 output.
 */

const PT_PER_MM = 72 / 25.4

// Helvetica advance widths (per 1000 em) for WinAnsi 32–126, used for text alignment
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584,
  556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278,
  469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260,
  334, 584,
]
const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584,
  611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333,
  584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280,
  389, 584,
]
const EXTRA_WIDTHS: Record<string, number> = { 'Ø': 778, '×': 584, '°': 400, '½': 834, '¼': 834, '¾': 834, 'µ': 556, '±': 584, '·': 278 }

// Characters outside WinAnsi that we map to something printable
const CHAR_FALLBACKS: Record<string, string> = { '″': '"', '′': "'", '≈': '~', '–': '-', '—': '-', '→': '->', '…': '...' }

function toWinAnsi(text: string): string {
  let out = ''
  for (const ch of text) {
    const mapped = CHAR_FALLBACKS[ch] ?? ch
    for (const c of mapped) {
      const code = c.charCodeAt(0)
      out += code < 256 ? c : '?'
    }
  }
  return out
}

export function textWidthMm(text: string, sizeMm: number, bold = false): number {
  const table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS
  let units = 0
  for (const ch of toWinAnsi(text)) {
    const code = ch.charCodeAt(0)
    units += code >= 32 && code <= 126 ? table[code - 32] : EXTRA_WIDTHS[ch] ?? 556
  }
  return (units / 1000) * sizeMm
}

function escapePdfString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function parseColor(color: string | undefined): [number, number, number] | null {
  if (!color || color === 'none') return null
  const hex = color.replace('#', '')
  if (/^[0-9a-f]{3}$/i.test(hex)) return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16) / 255) as [number, number, number]
  if (/^[0-9a-f]{6}$/i.test(hex)) return [0, 2, 4].map((i) => parseInt(hex.substring(i, i + 2), 16) / 255) as [number, number, number]
  const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((v) => parseInt(v, 10) / 255) as [number, number, number]
  return [0, 0, 0]
}

const f = (v: number) => (Math.round(v * 1000) / 1000).toString()

class PageWriter {
  ops: string[] = []
  constructor(private height: number) {}

  pt(p: Vec): string {
    return `${f(p.x * PT_PER_MM)} ${f((this.height - p.y) * PT_PER_MM)}`
  }

  arc(center: Vec, radius: number, start: number, sweep: number) {
    // Cubic Bézier approximation, ≤90° per piece
    const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9))
    const step = sweep / pieces
    const k = (4 / 3) * Math.tan(step / 4)
    for (let i = 0; i < pieces; i++) {
      const a0 = start + i * step
      const a1 = a0 + step
      const p0 = { x: center.x + radius * Math.cos(a0), y: center.y + radius * Math.sin(a0) }
      const p3 = { x: center.x + radius * Math.cos(a1), y: center.y + radius * Math.sin(a1) }
      const c1 = { x: p0.x - k * radius * Math.sin(a0), y: p0.y + k * radius * Math.cos(a0) }
      const c2 = { x: p3.x + k * radius * Math.sin(a1), y: p3.y - k * radius * Math.cos(a1) }
      this.ops.push(`${this.pt(c1)} ${this.pt(c2)} ${this.pt(p3)} c`)
    }
  }

  applyStyle(style: StrokeStyle) {
    const stroke = parseColor(style.stroke)
    const fill = parseColor(style.fill)
    if (stroke) {
      this.ops.push(`${stroke.map(f).join(' ')} RG`)
      this.ops.push(`${f((style.width ?? 0.25) * PT_PER_MM)} w`)
      this.ops.push(style.dash?.length ? `[${style.dash.map((d) => f(d * PT_PER_MM)).join(' ')}] 0 d` : '[] 0 d')
    }
    if (fill) this.ops.push(`${fill.map(f).join(' ')} rg`)
    return stroke && fill ? 'B' : fill ? 'f' : stroke ? 'S' : 'n'
  }

  item(item: DrawItem) {
    if (item.kind === 'text') {
      const color = parseColor(item.color ?? '#000') ?? [0, 0, 0]
      const width = textWidthMm(item.text, item.size, item.bold)
      const x = item.align === 'middle' ? item.at.x - width / 2 : item.align === 'end' ? item.at.x - width : item.at.x
      this.ops.push(`${color.map(f).join(' ')} rg`)
      this.ops.push(`BT /${item.bold ? 'F2' : 'F1'} ${f(item.size * PT_PER_MM)} Tf ${this.pt({ x, y: item.at.y })} Td (${escapePdfString(toWinAnsi(item.text))}) Tj ET`)
      return
    }
    this.ops.push('q')
    const paint = this.applyStyle(item.style)
    if (item.kind === 'line') {
      this.ops.push(`${this.pt(item.from)} m ${this.pt(item.to)} l`)
    } else if (item.kind === 'circle') {
      this.ops.push(`${this.pt({ x: item.center.x + item.radius, y: item.center.y })} m`)
      this.arc(item.center, item.radius, 0, Math.PI * 2)
      this.ops.push('h')
    } else {
      this.ops.push(`${this.pt(item.start)} m`)
      for (const seg of item.segments) {
        if (seg.type === 'line') this.ops.push(`${this.pt(seg.to)} l`)
        else if (seg.type === 'cubic') this.ops.push(`${this.pt(seg.c1)} ${this.pt(seg.c2)} ${this.pt(seg.to)} c`)
        else {
          const sweep = arcSweep(seg)
          if (Math.abs(sweep) < 1e-9) continue
          // Join the current point to the arc start in case they differ slightly
          this.ops.push(`${this.pt({ x: seg.center.x + seg.radius * Math.cos(seg.start), y: seg.center.y + seg.radius * Math.sin(seg.start) })} l`)
          this.arc(seg.center, seg.radius, seg.start, sweep)
        }
      }
      if (item.closed) this.ops.push('h')
    }
    this.ops.push(paint, 'Q')
  }
}

export interface PdfOptions {
  title?: string
}

/** Build a PDF (as bytes) with one page per drawing */
export function drawingsToPdf(drawings: Drawing[], options: PdfOptions = {}): Uint8Array<ArrayBuffer> {
  const objects: string[] = []
  const add = (body: string) => {
    objects.push(body)
    return objects.length
  }

  const catalogId = add('') // placeholder, filled below
  const pagesId = add('')
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const boldFontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')

  const pageIds: number[] = []
  for (const drawing of drawings) {
    const writer = new PageWriter(drawing.height)
    writer.ops.push('1 J 1 j') // round caps and joins
    writer.ops.push('q')
    if (drawing.clip) {
      const { x, y, width, height } = drawing.clip
      writer.ops.push(`${f(x * PT_PER_MM)} ${f((drawing.height - y - height) * PT_PER_MM)} ${f(width * PT_PER_MM)} ${f(height * PT_PER_MM)} re W n`)
    }
    for (const item of drawing.items) writer.item(item)
    writer.ops.push('Q')
    for (const item of drawing.overlay ?? []) writer.item(item)
    const content = writer.ops.join('\n')
    const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    const pageId = add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(drawing.width * PT_PER_MM)} ${f(drawing.height * PT_PER_MM)}] ` +
        `/Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    )
    pageIds.push(pageId)
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R /ViewerPreferences << /PrintScaling /None >> >>`
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
  const infoId = add(`<< /Title (${escapePdfString(toWinAnsi(options.title ?? 'Template'))}) /Producer (workshop-kit) >>`)

  // Everything is single-byte (WinAnsi), so string length == byte length
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefOffset = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) out += `${offset.toString().padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  const bytes = new Uint8Array(new ArrayBuffer(out.length))
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff
  return bytes
}
