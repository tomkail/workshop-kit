import { arcPoint, arcSweep, type Drawing, type DrawItem, type PathItem, type StrokeStyle } from './types'

const n = (v: number) => (Math.round(v * 1000) / 1000).toString()

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** SVG path data for a PathItem (arcs split so full circles work) */
export function pathData(item: Pick<PathItem, 'start' | 'segments' | 'closed'>): string {
  const parts = [`M${n(item.start.x)} ${n(item.start.y)}`]
  for (const seg of item.segments) {
    if (seg.type === 'line') {
      parts.push(`L${n(seg.to.x)} ${n(seg.to.y)}`)
      continue
    }
    if (seg.type === 'cubic') {
      parts.push(`C${n(seg.c1.x)} ${n(seg.c1.y)} ${n(seg.c2.x)} ${n(seg.c2.y)} ${n(seg.to.x)} ${n(seg.to.y)}`)
      continue
    }
    const sweep = arcSweep(seg)
    if (Math.abs(sweep) < 1e-9) continue
    // SVG can't draw a full circle in one arc command; split into ≤180° pieces
    const pieces = Math.ceil(Math.abs(sweep) / Math.PI - 1e-9)
    for (let i = 1; i <= pieces; i++) {
      const angle = seg.start + (sweep * i) / pieces
      const p = arcPoint(seg.center, seg.radius, angle)
      const large = Math.abs(sweep / pieces) > Math.PI ? 1 : 0
      const sweepFlag = sweep > 0 ? 1 : 0
      parts.push(`A${n(seg.radius)} ${n(seg.radius)} 0 ${large} ${sweepFlag} ${n(p.x)} ${n(p.y)}`)
    }
  }
  if (item.closed) parts.push('Z')
  return parts.join(' ')
}

function styleAttrs(style: StrokeStyle): string {
  const attrs = [
    `fill="${style.fill ?? 'none'}"`,
    `stroke="${style.stroke ?? 'none'}"`,
  ]
  if (style.stroke) {
    attrs.push(`stroke-width="${n(style.width ?? 0.25)}"`)
    attrs.push('stroke-linecap="round"', 'stroke-linejoin="round"')
    if (style.dash?.length) attrs.push(`stroke-dasharray="${style.dash.map(n).join(' ')}"`)
  }
  return attrs.join(' ')
}

function itemToSvg(item: DrawItem): string {
  switch (item.kind) {
    case 'path':
      return `<path d="${pathData(item)}" ${styleAttrs(item.style)}/>`
    case 'circle':
      return `<circle cx="${n(item.center.x)}" cy="${n(item.center.y)}" r="${n(item.radius)}" ${styleAttrs(item.style)}/>`
    case 'line':
      return `<line x1="${n(item.from.x)}" y1="${n(item.from.y)}" x2="${n(item.to.x)}" y2="${n(item.to.y)}" ${styleAttrs(item.style)}/>`
    case 'text': {
      const anchor = item.align === 'middle' ? 'middle' : item.align === 'end' ? 'end' : 'start'
      return `<text x="${n(item.at.x)}" y="${n(item.at.y)}" font-family="Helvetica, Arial, sans-serif" font-size="${n(item.size)}" font-weight="${item.bold ? 'bold' : 'normal'}" text-anchor="${anchor}" fill="${item.color ?? '#000'}">${escapeXml(item.text)}</text>`
    }
  }
}

let clipCounter = 0

export interface SvgOptions {
  background?: string
  title?: string
}

/**
 * Serialise a Drawing to SVG with physical units (width="…mm"), so it opens
 * at true size in Inkscape, Illustrator, laser/CNC software and browsers.
 */
export function drawingToSvg(drawing: Drawing, options: SvgOptions = {}): string {
  const group = (list: DrawItem[], prefix = '') => {
    const layers = new Map<string, string[]>()
    for (const item of list) {
      const layer = item.kind === 'text' ? item.layer : item.style.layer
      if (!layers.has(layer)) layers.set(layer, [])
      layers.get(layer)!.push(itemToSvg(item))
    }
    return Array.from(layers.entries())
      .map(([layer, items]) => `  <g id="${prefix}${escapeXml(layer)}">\n    ${items.join('\n    ')}\n  </g>`)
      .join('\n')
  }
  const groups = group(drawing.items)
  const overlay = drawing.overlay?.length ? `\n${group(drawing.overlay, 'overlay-')}` : ''
  const background = options.background
    ? `  <rect x="0" y="0" width="${n(drawing.width)}" height="${n(drawing.height)}" fill="${options.background}"/>\n`
    : ''
  const title = options.title ? `  <title>${escapeXml(options.title)}</title>\n` : ''
  const { clip } = drawing
  // Unique id: several SVGs share one document when printing tiled sheets
  const clipId = `page-clip-${++clipCounter}`
  const clipDef = clip
    ? `  <defs><clipPath id="${clipId}"><rect x="${n(clip.x)}" y="${n(clip.y)}" width="${n(clip.width)}" height="${n(clip.height)}"/></clipPath></defs>\n`
    : ''
  const body = clip ? `  <g clip-path="url(#${clipId})">\n${groups}\n  </g>` : groups
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${n(drawing.width)}mm" height="${n(drawing.height)}mm" viewBox="0 0 ${n(drawing.width)} ${n(drawing.height)}">
${title}${clipDef}${background}${body}${overlay}
</svg>
`
}
