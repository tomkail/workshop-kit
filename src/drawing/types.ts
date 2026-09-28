/**
 * A resolution-independent drawing in millimetres (y points down).
 *
 * Tools build a Drawing once and hand it to the SVG, PDF, DXF and print
 * backends, so every export carries the exact dimensions shown on screen.
 */

export interface Vec {
  x: number
  y: number
}

export interface LineSeg {
  type: 'line'
  to: Vec
}

/**
 * Circular arc. Angles are radians measured from +x towards +y (screen
 * clockwise), matching CanvasRenderingContext2D.arc(). `ccw` has the same
 * meaning as the canvas `counterclockwise` argument.
 */
export interface ArcSeg {
  type: 'arc'
  center: Vec
  radius: number
  start: number
  end: number
  ccw: boolean
}

/** Cubic Bézier from the current point */
export interface CubicSeg {
  type: 'cubic'
  c1: Vec
  c2: Vec
  to: Vec
}

export type Segment = LineSeg | ArcSeg | CubicSeg

export interface StrokeStyle {
  /** CSS colour for stroke; omit for no stroke */
  stroke?: string
  /** Stroke width in mm */
  width?: number
  /** Dash pattern in mm */
  dash?: number[]
  fill?: string
  /** Layer name used for DXF export and SVG grouping */
  layer: string
}

export interface PathItem {
  kind: 'path'
  start: Vec
  segments: Segment[]
  closed: boolean
  style: StrokeStyle
}

export interface CircleItem {
  kind: 'circle'
  center: Vec
  radius: number
  style: StrokeStyle
}

export interface LineItem {
  kind: 'line'
  from: Vec
  to: Vec
  style: StrokeStyle
}

export interface TextItem {
  kind: 'text'
  at: Vec
  text: string
  /** Cap height-ish font size in mm */
  size: number
  align?: 'start' | 'middle' | 'end'
  bold?: boolean
  color?: string
  layer: string
}

export type DrawItem = PathItem | CircleItem | LineItem | TextItem

export interface Drawing {
  /** Page / artboard size in mm */
  width: number
  height: number
  items: DrawItem[]
  /** Only show `items` inside this rectangle (used for tiled pages) */
  clip?: { x: number; y: number; width: number; height: number }
  /** Drawn on top and never clipped: headers, rulers, sheet labels */
  overlay?: DrawItem[]
}

/** Apply a point transform to every segment */
export function mapSegment(seg: Segment, p: (v: Vec) => Vec, scale = 1): Segment {
  switch (seg.type) {
    case 'line':
      return { ...seg, to: p(seg.to) }
    case 'cubic':
      return { ...seg, c1: p(seg.c1), c2: p(seg.c2), to: p(seg.to) }
    case 'arc':
      return { ...seg, center: p(seg.center), radius: seg.radius * scale }
  }
}

export function translateItems(items: DrawItem[], dx: number, dy: number): DrawItem[] {
  const t = (p: Vec): Vec => ({ x: p.x + dx, y: p.y + dy })
  return items.map((item) => {
    switch (item.kind) {
      case 'path':
        return {
          ...item,
          start: t(item.start),
          segments: item.segments.map((s) => mapSegment(s, t)),
        }
      case 'circle':
        return { ...item, center: t(item.center) }
      case 'line':
        return { ...item, from: t(item.from), to: t(item.to) }
      case 'text':
        return { ...item, at: t(item.at) }
    }
  })
}

export function arcPoint(center: Vec, radius: number, angle: number): Vec {
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
}

/** Signed sweep of an arc in radians (positive = increasing angle) */
export function arcSweep(seg: ArcSeg): number {
  const TAU = Math.PI * 2
  let delta = seg.end - seg.start
  // Treat rounding noise as a zero-length arc rather than a full turn
  if (Math.abs(delta) < 1e-9) return 0
  if (!seg.ccw) {
    delta = ((delta % TAU) + TAU) % TAU
    if (delta === 0 && seg.end !== seg.start) delta = TAU
  } else {
    delta = -((((-delta) % TAU) + TAU) % TAU)
    if (delta === 0 && seg.end !== seg.start) delta = -TAU
  }
  return delta
}

/** End point of a segment */
export function segmentEnd(seg: Segment): Vec {
  return seg.type === 'arc' ? arcPoint(seg.center, seg.radius, seg.start + arcSweep(seg)) : seg.to
}

/** Trace a path onto a canvas context (in whatever transform is active) */
export function tracePath(ctx: CanvasRenderingContext2D | Path2D, item: Pick<PathItem, 'start' | 'segments' | 'closed'>) {
  ctx.moveTo(item.start.x, item.start.y)
  for (const seg of item.segments) {
    if (seg.type === 'line') ctx.lineTo(seg.to.x, seg.to.y)
    else if (seg.type === 'cubic') ctx.bezierCurveTo(seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, seg.to.x, seg.to.y)
    else ctx.arc(seg.center.x, seg.center.y, seg.radius, seg.start, seg.start + arcSweep(seg), seg.ccw)
  }
  if (item.closed) ctx.closePath()
}
