import { arcPoint, arcSweep, type CubicSeg, type DrawItem, type Vec } from './types'

/**
 * Elliptical arc (canvas ellipse() semantics) as cubic Béziers, ≤90° per piece.
 * An ellipse is an affine image of a circle, so the usual 4/3·tan(θ/4) handles hold.
 */
export function ellipseArcToCubics(
  center: Vec,
  radiusX: number,
  radiusY: number,
  rotation: number,
  startAngle: number,
  endAngle: number,
  counterclockwise: boolean
): CubicSeg[] {
  const sweep = arcSweep({ type: 'arc', center, radius: 1, start: startAngle, end: endAngle, ccw: counterclockwise })
  if (Math.abs(sweep) < 1e-9) return []
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const point = (t: number): Vec => {
    const x = radiusX * Math.cos(t)
    const y = radiusY * Math.sin(t)
    return { x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos }
  }
  const tangent = (t: number): Vec => {
    const x = -radiusX * Math.sin(t)
    const y = radiusY * Math.cos(t)
    return { x: x * cos - y * sin, y: x * sin + y * cos }
  }
  const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9))
  const step = sweep / pieces
  const k = (4 / 3) * Math.tan(step / 4)
  const out: CubicSeg[] = []
  for (let i = 0; i < pieces; i++) {
    const t0 = startAngle + i * step
    const t1 = t0 + step
    const p0 = point(t0)
    const p1 = point(t1)
    const d0 = tangent(t0)
    const d1 = tangent(t1)
    out.push({ type: 'cubic', c1: { x: p0.x + k * d0.x, y: p0.y + k * d0.y }, c2: { x: p1.x - k * d1.x, y: p1.y - k * d1.y }, to: p1 })
  }
  return out
}

/** Bounding box of drawing items (curves sampled; text ignored) */
export function itemsBounds(items: DrawItem[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const add = (p: Vec) => {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  for (const item of items) {
    if (item.kind === 'circle') {
      add({ x: item.center.x - item.radius, y: item.center.y - item.radius })
      add({ x: item.center.x + item.radius, y: item.center.y + item.radius })
    } else if (item.kind === 'line') {
      add(item.from)
      add(item.to)
    } else if (item.kind === 'path') {
      let current = item.start
      add(current)
      for (const seg of item.segments) {
        if (seg.type === 'line') {
          current = seg.to
        } else if (seg.type === 'arc') {
          const sweep = arcSweep(seg)
          for (let i = 1; i <= 32; i++) add(arcPoint(seg.center, seg.radius, seg.start + (sweep * i) / 32))
          current = arcPoint(seg.center, seg.radius, seg.start + sweep)
        } else {
          const p0 = current
          for (let i = 1; i <= 16; i++) {
            const t = i / 16
            const u = 1 - t
            add({
              x: u * u * u * p0.x + 3 * u * u * t * seg.c1.x + 3 * u * t * t * seg.c2.x + t * t * t * seg.to.x,
              y: u * u * u * p0.y + 3 * u * u * t * seg.c1.y + 3 * u * t * t * seg.c2.y + t * t * t * seg.to.y,
            })
          }
          current = seg.to
        }
        add(current)
      }
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
