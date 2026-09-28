import { arcPoint, arcSweep, type Drawing, type DrawItem } from './types'

/**
 * Minimal ASCII DXF (R12-compatible entities, millimetre units) for CAD/CNC/laser.
 * Y is flipped so the drawing is upright in CAD's y-up space.
 */

const f = (v: number) => (Math.round(v * 10000) / 10000).toString()
const deg = (rad: number) => ((((rad * 180) / Math.PI) % 360) + 360) % 360

// AutoCAD colour index per layer, in order of first appearance
const ACI_CYCLE = [7, 1, 5, 3, 6, 4, 2, 8]

export interface DxfOptions {
  /** Only export these layers (default: all) */
  layers?: string[]
  /** Include text entities (default true) */
  text?: boolean
}

export function drawingToDxf(drawing: Drawing, options: DxfOptions = {}): string {
  const { layers, text = true } = options
  const H = drawing.height
  const y = (v: number) => f(H - v)
  const entities: string[] = []
  const layerNames: string[] = []

  const layerOf = (item: DrawItem) => (item.kind === 'text' ? item.layer : item.style.layer)
  const safeLayer = (name: string) => name.replace(/[^A-Za-z0-9_-]/g, '_').toUpperCase()

  const line = (layer: string, x1: number, y1: number, x2: number, y2: number) =>
    entities.push(`0\nLINE\n8\n${layer}\n10\n${f(x1)}\n20\n${y(y1)}\n30\n0\n11\n${f(x2)}\n21\n${y(y2)}\n31\n0`)

  for (const item of [...drawing.items, ...(drawing.overlay ?? [])]) {
    const name = layerOf(item)
    if (layers && !layers.includes(name)) continue
    if (item.kind === 'text' && !text) continue
    const layer = safeLayer(name)
    if (!layerNames.includes(layer)) layerNames.push(layer)

    switch (item.kind) {
      case 'circle':
        entities.push(`0\nCIRCLE\n8\n${layer}\n10\n${f(item.center.x)}\n20\n${y(item.center.y)}\n30\n0\n40\n${f(item.radius)}`)
        break
      case 'line':
        line(layer, item.from.x, item.from.y, item.to.x, item.to.y)
        break
      case 'text': {
        const align = item.align === 'middle' ? 1 : item.align === 'end' ? 2 : 0
        const pos = `10\n${f(item.at.x)}\n20\n${y(item.at.y)}\n30\n0`
        const alignPos = align ? `\n72\n${align}\n11\n${f(item.at.x)}\n21\n${y(item.at.y)}\n31\n0` : ''
        const content = item.text.replace(/″/g, '"').replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/[^\x20-\x7e%]/g, '')
        entities.push(`0\nTEXT\n8\n${layer}\n${pos}\n40\n${f(item.size)}\n1\n${content}${alignPos}`)
        break
      }
      case 'path': {
        let current = item.start
        for (const seg of item.segments) {
          if (seg.type === 'line') {
            line(layer, current.x, current.y, seg.to.x, seg.to.y)
            current = seg.to
            continue
          }
          if (seg.type === 'cubic') {
            // R12 has no splines; flatten finely enough for CNC
            const p0 = current
            const pieces = 24
            let prev = p0
            for (let i = 1; i <= pieces; i++) {
              const t = i / pieces
              const u = 1 - t
              const pt = {
                x: u * u * u * p0.x + 3 * u * u * t * seg.c1.x + 3 * u * t * t * seg.c2.x + t * t * t * seg.to.x,
                y: u * u * u * p0.y + 3 * u * u * t * seg.c1.y + 3 * u * t * t * seg.c2.y + t * t * t * seg.to.y,
              }
              line(layer, prev.x, prev.y, pt.x, pt.y)
              prev = pt
            }
            current = seg.to
            continue
          }
          const sweep = arcSweep(seg)
          const endAngle = seg.start + sweep
          current = arcPoint(seg.center, seg.radius, endAngle)
          if (Math.abs(sweep) < 1e-9) continue
          // Flipping y negates angles and reverses orientation. DXF arcs always
          // run counter-clockwise (y-up) from start to end angle.
          const [a, b] = sweep > 0 ? [-endAngle, -seg.start] : [-seg.start, -endAngle]
          entities.push(
            `0\nARC\n8\n${layer}\n10\n${f(seg.center.x)}\n20\n${y(seg.center.y)}\n30\n0\n40\n${f(seg.radius)}\n50\n${f(deg(a))}\n51\n${f(deg(b))}`
          )
        }
        if (item.closed && (Math.abs(current.x - item.start.x) > 1e-6 || Math.abs(current.y - item.start.y) > 1e-6)) {
          line(layer, current.x, current.y, item.start.x, item.start.y)
        }
        break
      }
    }
  }

  const layerTable = layerNames
    .map((name, i) => `0\nLAYER\n2\n${name}\n70\n0\n62\n${ACI_CYCLE[i % ACI_CYCLE.length]}\n6\nCONTINUOUS`)
    .join('\n')

  return [
    '0\nSECTION\n2\nHEADER',
    '9\n$ACADVER\n1\nAC1009',
    '9\n$INSUNITS\n70\n4',
    '9\n$MEASUREMENT\n70\n1',
    `9\n$EXTMIN\n10\n0\n20\n0\n30\n0`,
    `9\n$EXTMAX\n10\n${f(drawing.width)}\n20\n${f(drawing.height)}\n30\n0`,
    '0\nENDSEC',
    '0\nSECTION\n2\nTABLES',
    `0\nTABLE\n2\nLAYER\n70\n${layerNames.length}`,
    layerTable,
    '0\nENDTAB',
    '0\nENDSEC',
    '0\nSECTION\n2\nENTITIES',
    ...entities,
    '0\nENDSEC',
    '0\nEOF',
  ]
    .filter(Boolean)
    .join('\n') + '\n'
}
