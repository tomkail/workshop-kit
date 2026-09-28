import { useEffect, useState } from 'react'
import type { CanvasTheme } from '../theme/types'
import type { Point } from './viewport'

/**
 * Hover tooltips for canvas handles, in Serpentine's style: the current
 * value in the accent colour, what dragging or clicking does, and the
 * modifier keys that change it. A modifier line lights up while its key is
 * held, so people discover Shift-to-drag-freely and the like.
 *
 * Show it while hovering, not while dragging (show the value some other
 * way during a drag, if at all).
 */

export interface TooltipContent {
  /** Current value, e.g. "r: 50" or "module 4 (6.35 DP)" */
  value?: string
  /** What the pointer does here, e.g. "Drag to scale" */
  action?: string
  /** Modifier hints, e.g. ["⇧ drag freely", "⌥ from opposite"]. Lead with the key symbol. */
  modifiers?: string[]
}

export type TooltipAnchor = 'above' | 'below' | 'left' | 'right'

export interface ModifierState {
  shift: boolean
  alt: boolean
  meta: boolean
  ctrl: boolean
}

export const NO_MODIFIERS: ModifierState = { shift: false, alt: false, meta: false, ctrl: false }

/** True when a hint's key symbol (⇧ ⌥ ⌘ ⌃) is held; "⇧/⌥ both" matches either */
export function isModifierHeld(hint: string, held: ModifierState): boolean {
  return (hint.includes('⇧') && held.shift) || (hint.includes('⌥') && held.alt) || (hint.includes('⌘') && held.meta) || (hint.includes('⌃') && held.ctrl)
}

/** Live modifier-key state, for lighting up tooltip hints without waiting for the pointer to move */
export function useModifierKeys(): ModifierState {
  const [state, setState] = useState<ModifierState>(NO_MODIFIERS)
  useEffect(() => {
    const update = (e: KeyboardEvent | PointerEvent) =>
      setState((prev) =>
        prev.shift === e.shiftKey && prev.alt === e.altKey && prev.meta === e.metaKey && prev.ctrl === e.ctrlKey ? prev : { shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, ctrl: e.ctrlKey }
      )
    const reset = () => setState(NO_MODIFIERS)
    window.addEventListener('keydown', update)
    window.addEventListener('keyup', update)
    window.addEventListener('pointermove', update)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', update)
      window.removeEventListener('keyup', update)
      window.removeEventListener('pointermove', update)
      window.removeEventListener('blur', reset)
    }
  }, [])
  return state
}

const CONFIG = {
  fontSize: 11,
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  padding: { x: 10, y: 8 },
  /** Gap between the anchor point and the tooltip */
  offset: 16,
  radius: 5,
  lineHeight: 1.5,
  /** Extra space between the value and the lines under it */
  sectionGap: 6,
  /** Keep this far inside the canvas edges */
  margin: 6,
}

interface Line {
  text: string
  color: string
  size: number
  opacity: number
}

/**
 * Draw a tooltip at a point in screen (CSS) pixels. Call with the context
 * set to CSS-pixel units, e.g. ctx.setTransform(dpr, 0, 0, dpr, 0, 0).
 * The tooltip is kept inside the canvas.
 */
export function drawTooltip(
  ctx: CanvasRenderingContext2D,
  content: TooltipContent,
  at: Point,
  theme: CanvasTheme,
  options: { anchor?: TooltipAnchor; held?: ModifierState } = {}
) {
  const { anchor = 'above', held = NO_MODIFIERS } = options
  const small = CONFIG.fontSize * 0.9
  const lines: Line[] = []
  if (content.value) lines.push({ text: content.value, color: theme.accent, size: CONFIG.fontSize, opacity: 1 })
  if (content.action) lines.push({ text: content.action, color: theme.ui.textPrimary, size: small, opacity: 0.85 })
  for (const hint of content.modifiers ?? []) {
    const active = isModifierHeld(hint, held)
    lines.push({ text: hint, color: active ? theme.accent : theme.ui.textPrimary, size: small, opacity: active ? 1 : 0.6 })
  }
  if (!lines.length) return

  ctx.save()
  let width = 0
  for (const line of lines) {
    ctx.font = `500 ${line.size}px ${CONFIG.fontFamily}`
    width = Math.max(width, ctx.measureText(line.text).width)
  }
  const gap = content.value && lines.length > 1 ? CONFIG.sectionGap : 0
  const height = lines.reduce((h, l) => h + l.size * CONFIG.lineHeight, 0) + gap
  const w = width + CONFIG.padding.x * 2
  const h = height + CONFIG.padding.y * 2

  let x = at.x - w / 2
  let y = at.y - CONFIG.offset - h
  if (anchor === 'below') y = at.y + CONFIG.offset
  if (anchor === 'left' || anchor === 'right') {
    x = anchor === 'left' ? at.x - CONFIG.offset - w : at.x + CONFIG.offset
    y = at.y - h / 2
  }
  // Keep it on the canvas; flip above/below rather than cover the handle
  const cw = ctx.canvas.clientWidth || Infinity
  const ch = ctx.canvas.clientHeight || Infinity
  if (anchor === 'above' && y < CONFIG.margin) y = at.y + CONFIG.offset
  if (anchor === 'below' && y + h > ch - CONFIG.margin) y = at.y - CONFIG.offset - h
  x = Math.max(CONFIG.margin, Math.min(cw - CONFIG.margin - w, x))
  y = Math.max(CONFIG.margin, Math.min(ch - CONFIG.margin - h, y))

  ctx.fillStyle = theme.fill
  ctx.strokeStyle = theme.chrome
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CONFIG.radius)
  ctx.fill()
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let cy = y + CONFIG.padding.y
  lines.forEach((line, i) => {
    const lh = line.size * CONFIG.lineHeight
    ctx.globalAlpha = line.opacity
    ctx.font = `500 ${line.size}px ${CONFIG.fontFamily}`
    ctx.fillStyle = line.color
    ctx.fillText(line.text, x + w / 2, cy + lh / 2)
    cy += lh + (i === 0 ? gap : 0)
  })
  ctx.restore()
}
